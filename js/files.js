"use strict";

// open a javascript debug window with cntl-z
// http://stackoverflow.com/questions/16006583/capturing-ctrlz-key-combination-in-javascript
var gui = require('nw.gui');

// this is the current files window which morphs into a status window
var status_win = gui.Window.get();

$(document).keydown(function(e){
      if( e.which === 90 && e.ctrlKey ){
         //alert('control + z, debug window enabled'); 
         status_win.showDevTools();
      }
}); 

var myos = require('os');

// load packages for generating unique snowflake ids used to lable edges uniquely
// https://blog.tompawlak.org/generate-unique-identifier-nodejs-javascript
var FlakeIdGen = require('flake-idgen')
    , intformat = require('biguint-format')
    , generator = new FlakeIdGen;

// machinery for handling hivtrace status messages
var EventEmitter = require('events');
var ee = new EventEmitter();
var current_progress = 0;

// for spawning the hivtrace python process
var childProcess = require('child_process');

// input filenames with path 
var node_csv_file; // the filename of the user selected input csv file containing node information
var edge_csv_file; // the filename of the user selected input csv file containing edge information
var fasta_file; // the filename of the user selected input fasta file
var useFASTA; // whether or not a fasta file is being used to generate the network
var lengthsPresent = true; // true if there are lat lon data in node csv file
var all_fasta_descr; // a list of all fasta descriptors in fasta file
var all_hivtrace_nodes; // a list of all nodes from hivtrace
var all_edge_csv_nodes; // a list of all nodes from the edge file
var all_hivtrace_edges; // a list of all edges from hivtrace
var node_csv_ids_to_edge_csv_ids;  // a mapping from node csv ids to hivtrace fasta ids
var map_fasta_id_min_length; // map from csv node to min length as output by hivtrace
var max_node_csv_data = new Map(); // map node_csv_data (via csv_index) to max value (if a "num")
var max_edge_csv_data = new Map(); // map edge_csv_data (via csv_index) to max value (if a "num")
var min_node_csv_data = new Map(); // map node_csv_data (via csv_index) to min value (if a "num")
var min_edge_csv_data = new Map(); // map edge_csv_data (via csv_index) to min value (if a "num")

// data from input files 
var node_csv_data_w_header;  // all node csv data including the header
var edge_csv_data_w_header = [];  // all edge csv data including the header
var node_csv_data;  // all node csv data (except for the header)
var edge_csv_data;  // all edge csv data (except for the header)
var node_csv_data_t;  // all node csv data transposed
var edge_csv_data_t;  // all edge csv data transposed
var node_csv_data_header; // list of all node csv column headers (first row of node_csv_data)
var edge_csv_data_header; // list of all edge csv column headers (first row of edge_csv_data)

var unique_node_csv_data_t = []; // a list (of lists) of unique data within each node csv column
var unique_edge_csv_data_t = [];  // a list (of lists) of unique data within each edge csv column
var node_csv_data_type = []; // the data type of each node csv column
var edge_csv_data_type = []; // the data type of each edge csv column
// note only the node csv data is displayed so no edge version
var datatable_data_header = []; // list of csv column headers in form usable by datatable
var network_node_csv_data;  // all csv node data rows that come out of hivtrace
var fasta_data; // the fasta data
var python_data = ''; // the full output of hivtrace (minus status msgs)
var myNodes; // js array of nodes the app supplies
var myEdges; // js array of edges the app supplies

// note this is the network win from the perspective of files.js.
// there is another network_win inside the network.js environment
var network_win = 0;

// define a function to go the next page
var aWhile = 5000; // 5 seconds
// this function will go onto the next page 5 seconds after the trigger is set by
var doSomethingAfterAWhile = function() {
    console.log("network.html about to be loaded into main_panel");
    current_progress = current_progress + 5;
    updateProgress(current_progress, 'Creating network window...');
    var outputDebugJson = true;
    if(outputDebugJson)
        saveDebugJson();

    createNetworkWindow(status_win);
}

// This not used now but is a way to open the network window based on a checkbox on the files.html page.
// This makes sense if there is a hiveplot implemented later and would allow the user to choose either network or hiveplot or both
function handleNetwork(cb) {
    console.log("network window checkbox has new state: " + cb.checked );
    if(cb.checked) {
        createNetworkWindow();
    } else {
        closeNetworkWindow();
    }
}

var networkWindowOptions = {
    show: true,
    "new-instance": false,
    "toolbar": false, // this makes a debug window available if set to true
    "width": 800,
    "height": 600,
    "icon": "icons/image16.png"
}
    
var network_win_is_initialized = false;

function createNetworkWindow(current_win) {
    network_win = gui.Window.open("network.html", networkWindowOptions); 
    
    network_win.on ('loaded', function(){
        if(!network_win_is_initialized) {
            init_network_win(current_win);
            network_win_is_initialized = true;
        } 
    });
    
    network_win.on('close', closeNetworkWindow);
}

function init_network_win(current_win) {
        network_win.window.haveParent(current_win);
        network_win.window.createAndPopulateNetwork(myNodes, myEdges);
        console.log("network window finished loading and populating");
}
    
function closeNetworkWindow() {
    console.log('network window is closing');
    network_win.window.closeAllWindows();
    // $('input:checkbox[name=networkcb]').attr('checked',false);
    network_win = 0;
}

// close all child windows upon app exit
status_win.on('close', closeAllWindows);
    
function closeAllWindows() {
    if(network_win != 0)
        closeNetworkWindow();
    //
    // and finally close the status (this) window
    status_win.hide();
    console.log('status window is closing');
    status_win.close(true);
}

// this function post processes after the node csv has been successfully parsed
function post_parse_node_csv(processFASTA) {
    console.log("Node CSV file format validated");
    current_progress = current_progress + 5;
    updateProgress(current_progress, 'Validating Node CSV file...');

    node_csv_data_header = node_csv_data_w_header[0];
    // take the first 'ID' column as the fasta id if it exists
    var foundID = node_csv_data_header.indexOf("ID");
    var foundid = node_csv_data_header.indexOf("id");
    if((foundID) != -1 || (foundid != -1)) {
        if(foundID == -1)
            foundID = foundid;
        console.log("found ID or id, reordering csv columns");
        // switch this column to be the first column
        for(var i=0; i<node_csv_data_w_header.length; i++) {
            // move to start
            node_csv_data_w_header[i].splice(0,0,node_csv_data_w_header[i][foundID]);
            // remove element
            node_csv_data_w_header[i].splice(foundID+1,1);
        }
        node_csv_data_header = node_csv_data_w_header[0];
    }

    // take off first row
    node_csv_data = clone(node_csv_data_w_header);
    node_csv_data.splice(0,1);

    // get transpose of array
    node_csv_data_t = get_transpose(node_csv_data);

    // get unique column values
    get_unique_column_node_values();

    // get datatypes for all csv columns
    get_node_datatypes();

    // get minmax for all csv columns
    get_node_minmax();

    // now ask the user whether to perform null filling
    var null_cols = get_null_col_names();
    if(null_cols.length > 0) {
        var message3 = "You will be able to optionally choose the data in a column of your node csv file to modify each node's 'Size' and 'Opacity' attributes.  These modifiers need numeric data with few nulls. <br><br>The following 'almost' numeric node csv columns contain one or more nulls: <br><br>" + null_cols.join(', ') + ".<br><br> Click \'Include Columns\' to include these node csv columns for attribute modification anyway.  Clicking here will cause nodes with null data to appear but without attributes modified.<br><br>Click \'Remove Columns\' to remove these node csv columns as possible attribute modifier selections for 'Size' and 'Opacity'.";
        console.log(message3);
        BootstrapDialog.show({
            title: 'Node CSV Warning',
            message: message3,
            draggable: true,
            buttons: [{
                label: 'Include Columns',
                cssClass: 'btn-primary',
                action: function(dialogItself) {
                    dialogItself.close();
                    fill_node_nulls();
                    get_node_minmax();
                    post_post_parse_node_csv(processFASTA);
                    // everything ready for edge csv inputted display, so next go to network page
                    //setTimeout( doSomethingAfterAWhile, aWhile );
                }
           }, {
                label: 'Remove Columns',
                action: function(dialogItself){
                    dialogItself.close();
                    post_post_parse_node_csv(processFASTA);
                    // everything ready for edge csv inputted display, so next go to network page
                    //setTimeout( doSomethingAfterAWhile, aWhile );
               }
           }]
       });
    } 
}

// this function post processes after post_parse_node_csv()
function post_post_parse_node_csv(processFASTA) {
    // check that there are no repeated (fasta) id names 
    // in the csv file.  Error notice if there are
    console.log("node_csv_data length is: " + node_csv_data.length);

    if(unique_node_csv_data_t[0].length < node_csv_data.length) {
        // we know there are repeats, now find out where
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf
        var indices = [];
        var already_reported = [];
        var clear_rows_after = [];
        var warning_addendum = "";
        var element, idx;
        for(var i=0; i< node_csv_data_t[0].length; i++) {
            element = node_csv_data_t[0][i];
            idx = node_csv_data_t[0].indexOf(element, i);
            while (idx != -1) {
                indices.push(idx);
                idx = node_csv_data_t[0].indexOf(element, idx + 1);
            }
            if(indices.length > 1 && already_reported.indexOf(element) == -1) {
                warning_addendum = warning_addendum + "\n" + element + " appears in rows: " + indices;
                already_reported.push(element);
                clear_rows_after = clear_rows_after.concat(indices.slice(1));
            }
            indices = [];
        }
        var message4 = 'The CSV file contains multiple rows with the same FASTA id.  There should be only one row for each FASTA id. Only the first occurence will be kept.' + warning_addendum + "\nRemoving rows: " + clear_rows_after;
        console.log(message4);
        BootstrapDialog.show({ 
            title: 'Node CSV Warning', 
            message: message4 , 
            draggable: true, 
            type: BootstrapDialog.TYPE_INFO,
            buttons: [{
                label: 'Ok',
                action: function(dialogItself){
                    for(var i=clear_rows_after.length-1;i>-1;i--) {
                        console.log("removing csv row: " + clear_rows_after[i]);
                        node_csv_data.splice(clear_rows_after[i],1);
                    }
                    post_post_post_parse_node_csv();
                    if(Boolean(processFASTA)) {
                        validateFASTArunHivtrace();
                    }
                    dialogItself.close();
                }
            }]
        });
    } else {
        post_post_post_parse_node_csv();
        if(Boolean(processFASTA)) {
           validateFASTArunHivtrace();
        }
    }
    if(!isBlank(edge_csv_file)) {
        gen_edge_csv_maps();
        setTimeout( doSomethingAfterAWhile, aWhile );
    }
}

function post_post_post_parse_node_csv() {
    // create the datatable column list (used in datagrid)
    for (var i = 0; i < node_csv_data_header.length; i++) {
        datatable_data_header.push({"title" : node_csv_data_header[i] });
    }

    console.log("Node CSV file validated");
    console.log("completed node csv array operations");
    // $(this).html('CSV file validated...'); 
    current_progress = current_progress + 5;
    updateProgress(current_progress, 'Node CSV file validated.');
}

function validateFASTArunHivtrace() {
    updateProgress(current_progress, 'Validating FASTA file...');
    var err;
    fasta_data = fs.readFileSync(fasta_file, 'utf8', function (err, data) {
        if (err) {
            console.log(err);
            BootstrapDialog.show({
                title: 'FASTA Error', 
                message: err.message, 
                draggable: true, 
                type: BootstrapDialog.TYPE_DANGER,
                buttons: [{
                    label: 'Exit',
                    action: function(dialogItself){
                        dialogItself.close();
                        process.exit(-1);
                    }
                }]
            });
        }
    });

    // replace dos or old-mac style line endings - linux (within which python runs) wants unix style
    var pattern = /(\r\n|\n|\r)/gm;
    console.log("length of fasta data is: " + fasta_data.length);
    fasta_data = fasta_data.replace(pattern,"\n");
    console.log("length of fasta data after newline processing is: " + fasta_data.length);

    var validateDNAResults = validateDNA(fasta_data);
    if (validateDNAResults.status != "ok") {
        console.error(valid_seqs);
        BootstrapDialog.show({
            title: 'FASTA Error', 
            message: valid_seqs, 
            draggable: true, 
            type: BootstrapDialog.TYPE_DANGER,
            buttons: [{
                label: 'Exit',
                action: function(dialogItself){
                    dialogItself.close();
                    process.exit(-1);
                }
            }]
        });
    } else {
        console.log("FASTA valid");
        // $(this).html('FASTA valid');
        current_progress = current_progress + 5
        updateProgress(current_progress, 'FASTA file validated.');
    }
    all_fasta_descr = clone(validateDNAResults.descriptors);
    console.log("all_fasta_descr length: "+all_fasta_descr.length);
    var output_all_fasta_descr = true; // xxxxera
    if(output_all_fasta_descr) {
        var yourCallback = function(){};
        fs.writeFile( "../debug_json/all_fasta_descr.json", JSON.stringify( all_fasta_descr ), "utf8", yourCallback );
    }
    if(!isBlank(node_csv_file)) {  // don't check fastas_not_in_csv if no node csv file
        // check to see if all fasta names appear in csv, if not warn
        var fastas_not_in_csv = difference(all_fasta_descr, unique_node_csv_data_t[0]);
        var output_fastas_not_in_csv = true; // xxxxera
        if(output_fastas_not_in_csv) {
            var yourCallback = function(){};
            fs.writeFile( "../debug_json/fastas_not_in_csv.json", JSON.stringify( fastas_not_in_csv ), "utf8", yourCallback );
        }
        if(fastas_not_in_csv.length > 0) {
            var message1 = 'These fasta ids do not appear in the csv file: ' + fastas_not_in_csv.join(', ');
            console.log(message1);
            BootstrapDialog.show({
                title: 'FASTA Warning', 
                message: message1, 
                draggable: true, 
                closable: false,
                type: BootstrapDialog.TYPE_INFO,
                buttons: [{
                    label: 'Ok',
                    action: function(dialogItself){
                        dialogItself.close();
                        finish_ppp_parse();
                    }
                }]
            });
        } else {
            finish_ppp_parse();
        }
    } else {
        finish_ppp_parse();
    }
}

function saveDebugJson() {
    var fs = require('fs');
    var save_for_debug = true;
    if(save_for_debug) {
        console.log("writing out debug json files to mtnt/debug_json directory");
        var yourCallback = function(){};
        fs.writeFile( "../debug_json/node_csv_file.json", JSON.stringify( node_csv_file ), "utf8", yourCallback );
        fs.writeFile( "../debug_json/node_csv_data.json", JSON.stringify( node_csv_data ), "utf8", yourCallback );
        fs.writeFile( "../debug_json/node_csv_data_header.json", JSON.stringify( node_csv_data_header ), "utf8", yourCallback );
        fs.writeFile( "../debug_json/datatable_data_header.json", JSON.stringify( datatable_data_header ), "utf8", yourCallback );
        fs.writeFile( "../debug_json/unique_node_csv_data_t.json", JSON.stringify( unique_node_csv_data_t ), "utf8", yourCallback );
        fs.writeFile( "../debug_json/node_csv_data_type.json", JSON.stringify( node_csv_data_type ), "utf8", yourCallback );
    }
}

function finish_ppp_parse() {
    updateProgress(current_progress, 'About to run hivtrace.');

    // finally kick off the python hivtrace process
    console.log("runHivtrace() about to be called.");
    runHivtrace();
    console.log("runHivtrace() called.");
}

// this function post processes after the edge csv has been successfully parsed
function post_parse_edge_csv(processNodeCSV) {
    console.log("Edge CSV file parsed and validated.");
    current_progress = current_progress + 5;
    updateProgress(current_progress, 'Parsed and validated Edge CSV file.');

    edge_csv_data_header = edge_csv_data_w_header[0];
    // The desired config is 'source', 'target' as the first two column headers.
    // If 'source' and 'target' aren't found, look for 'from' and 'to'.
    // If these (to, from) are not found, then take the first column as the source and the second column as the target
    var foundSource = edge_csv_data_header.indexOf("source");
    var foundDestination = edge_csv_data_header.indexOf("target");
    var foundLength = edge_csv_data_header.indexOf("length");
    if(foundSource == -1 && foundDestination == -1) {
        foundSource = edge_csv_data_header.indexOf("from");
        foundDestination = edge_csv_data_header.indexOf("to");
    }
    if(foundSource != -1 && foundDestination != -1) {
        console.log("found source and target columns, reordering csv columns");
        // switch the target column to be the first column
        for(var i=0; i<edge_csv_data_w_header.length; i++) {
            // move to start
            edge_csv_data_w_header[i].splice(0,0,edge_csv_data_w_header[i][foundDestination]);
            edge_csv_data_w_header[i].splice(foundDestination+1,1);
        }
        foundSource = edge_csv_data_header.indexOf("source");
        if(foundSource == -1) {
            foundSource = edge_csv_data_header.indexOf("to");
        }
        // switch the source column to be the first column
        for(var i=0; i<edge_csv_data_w_header.length; i++) {
            // move to start
            edge_csv_data_w_header[i].splice(0,0,edge_csv_data_w_header[i][foundSource]);
            // remove element
            edge_csv_data_w_header[i].splice(foundSource+1,1);
        }
        //node_csv_data_header = node_csv_data_w_header[0];
        edge_csv_data_header = edge_csv_data_w_header[0];
    } else {
        var message5 = "Column headers for \'source\' and \'target\' or \'from\' and \'to\' nodes not found in edge csv file. Please fix your edge csv file input and rerun."
        console.log(message5);
        BootstrapDialog.show({
            title: 'Edge CSV Warning', 
            message: message5, 
            draggable: true, 
            type: BootstrapDialog.TYPE_INFO,
            buttons: [{
                label: 'Exit',
                action: function(dialogItself){
                    dialogItself.close();
                    process.exit(-1);
                }
            }]
        });
    }
    if( foundLength == -1) { // no 'length' column header found
        var msg = 'The Edge CSV file does not contain a column header with the name \'length\'.  A \'length\' column is used to specify the connection strength between nodes.  Please add a column with length data or change the column header of an existing connection strength column in the edge-csv file to \'length\' and re-run.  If you do not add a \'length\' column nodes and objects will be displayed, but edge thresholding will not be possible.  The histogram plot will also not be available.';
        console.log(msg);
        BootstrapDialog.show({ 
            title: 'Edge CSV Warning', 
            message: msg,  
            draggable: true, 
            type: BootstrapDialog.TYPE_INFO,
            buttons: [{
                label: 'Exit',
                cssClass: 'btn-primary',
                action: function(dialogItself) {
                    dialogItself.close();
                    process.exit(-1);
                }
           }, {
               label: 'Continue',
               action: function(dialogItself){
                   dialogItself.close();
                   continue_post_parse_edge_csv(processNodeCSV);
               }
           }]
        });
        lengthsPresent = false;
    } else {
        continue_post_parse_edge_csv(processNodeCSV);
    }
}

function continue_post_parse_edge_csv(processNodeCSV) {
    // take off first row
    edge_csv_data = clone(edge_csv_data_w_header);
    edge_csv_data.splice(0,1);

    // get transpose of array
    edge_csv_data_t = get_transpose(edge_csv_data);

    // get unique column values
    get_unique_column_edge_values();

    // get datatypes for all edge csv columns
    get_edge_datatypes();

    // get minmax for all edge csv columns
    //get_edge_minmax(); done later

    // now ask the user whether to perform null filling
    var null_cols = get_null_col_names();
    if(null_cols.length > 0) {
        var message3 = "You will be able to optionally choose the data in a column of your edge csv file to modify each edge's 'Width' and 'Opacity' attributes.  These modifiers need numeric data with few nulls. <br><br>The following 'almost' numeric edge csv columns contain one or more nulls: <br><br>" + null_cols.join(', ') + ".<br><br> Click \'Include Columns\' to include these edge csv columns for attribute modification anyway.  Clicking here will cause edges with null data to appear but without attributes modified.  <br><br>Click \'Remove Columns\' to remove these edge csv columns as possible attribute modifier selections for 'Width' and 'Opacity'.";
        console.log(message3);
        BootstrapDialog.show({
            title: 'Edge CSV Warning',
            message: message3,
            draggable: true,
            buttons: [{
                label: 'Include Columns',
                cssClass: 'btn-primary',
                action: function(dialogItself) {
                    fill_edge_nulls();
                    console.log("fill_edge_nulls() called");
                    get_edge_minmax();
                    dialogItself.close();
                    // console.log("calling doRest from BootstrapDialog");
                    doRest(processNodeCSV);
                }
            }, {
               label: 'Remove Columns',
               action: function(dialogItself){
                   dialogItself.close();
                   // console.log("calling doRest from BootstrapDialog");
                   doRest(processNodeCSV);
               }
            }]
        });
    } else {
        // console.log("calling doRest from else");
        doRest(processNodeCSV);
    }
}

function doRest(processNodeCSV) {
    post_post_parse_edge_csv();
    if(Boolean(processNodeCSV)) {
        post_parse_node_csv(false);
    } else {
        // this done in post_parse_node_csv above, so must do it here for non-node csv case
        setTimeout( doSomethingAfterAWhile, aWhile );
    }
}

// this function post processes after post_parse_edge_csv()
function post_post_parse_edge_csv() {
    // check that there are no repeated (source-target) id names 
    // in the csv file.  Error notice if there are
    // xxxera - perhaps check entire line is a duplicate?
    console.log("edge_csv_data length is: " + edge_csv_data.length);

    // for right now there is no checking for repeats xxxera
    /*
    if(unique_edge_csv_data_t[0].length < edge_csv_data.length) {
        // we know there are repeats, now find out where
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf
        var indices = [];
        var already_reported = [];
        var clear_rows_after = [];
        var warning_addendum = "";
        var element, idx;
        for(var i=0; i< edge_csv_data_t[0].length; i++) {
            element = edge_csv_data_t[0][i];
            idx = edge_csv_data_t[0].indexOf(element, i);
            while (idx != -1) {
                indices.push(idx);
                idx = edge_csv_data_t[0].indexOf(element, idx + 1);
            }
            if(indices.length > 1 && already_reported.indexOf(element) == -1) {
                warning_addendum = warning_addendum + "\n" + element + " appears in rows: " + indices;
                already_reported.push(element);
                clear_rows_after = clear_rows_after.concat(indices.slice(1));
            }
            indices = [];
        }
        BootstrapDialog.show({ title: 'Node CSV Warning', message: 'The CSV file contains multiple rows with the same FASTA id.  There should be only one row for each FASTA id. Only the first occurence will be kept.' + warning_addendum + "\nRemoving rows: " + clear_rows_after, draggable: true, type: BootstrapDialog.TYPE_INFO
        });
        for(var i=clear_rows_after.length-1;i>-1;i--) {
            console.log("removing csv row: " + clear_rows_after[i]);
            edge_csv_data.splice(clear_rows_after[i],1);
        }
    } */

    // make the network object
    // first get a master list of all nodes - do an or of the source and taget columns
    // http://stackoverflow.com/questions/3629817/getting-a-union-of-two-arrays-in-javascript
    var a = unique_edge_csv_data_t[0];
    var b = unique_edge_csv_data_t[1];
    //var all_edge_csv_nodes = [...new Set([...a, ...b])];
    all_edge_csv_nodes = union_arrays(a,b);
    myNodes = [];
    for(var i = 0; i < all_edge_csv_nodes.length; i++) {
        //myNodes.push({"id":all_edge_csv_nodes[i],"label":all_edge_csv_nodes[i]}); don't add label from start
        myNodes.push({"id":all_edge_csv_nodes[i]});
    }
    myEdges = [];
    var id1;
    var id3 = "";
    var from = "";
    var to = "";
    for(var j = 0; j < edge_csv_data.length; j++){
        // for now, make label = id
        id1 = generator.next();
        id3 = intformat(id1, 'dec');
        from = edge_csv_data[j][0];
        to = edge_csv_data[j][1];
        myEdges.push({"id":id3,"from":from,"to":to});
        // and add the unique id to the beginning of the edge_csv_data array
        edge_csv_data[j].unshift(id3);
    }
    // and add header info
    edge_csv_data_header.unshift("id"); // for auto-generated id

    // and redo the array processing
    // get transpose of array
    edge_csv_data_t = get_transpose(edge_csv_data);

    // get unique column values
    get_unique_column_edge_values();

    // get datatypes for all edge csv columns
    get_edge_datatypes();

    // get minmax for all edge csv columns
    get_edge_minmax();

    var message6 = 'Edge CSV validated and network objects loaded.';
    //console.log(message6);
    updateProgress(current_progress, message6);

    // next go to network page
    //setTimeout( doSomethingAfterAWhile, aWhile );
}

function gen_edge_csv_maps() {
    node_csv_ids_to_edge_csv_ids = new Map(); 
    console.log("creating map from node csv ids to edge csv ids.");
    // Make a mapping (node_csv_ids_to_edge_csv_ids) from csv fasta ids to 
    network_node_csv_data = [];  // all csv rows in the network 
    for(var i = 0; i < all_edge_csv_nodes.length; i++) {
        var re1 = new RegExp("^" + all_edge_csv_nodes[i] + "$");
        //unique_node_csv_data_t[0] contains all the unique csv fasta ids
        for(var j = 0; j < unique_node_csv_data_t[0].length; j++) {
            // compares all_edge_csv_nodes with node csv (fasta) ids
            if( re1.test(unique_node_csv_data_t[0][j]) ) {
                // make an array of csv data rows only associated 
                // with nodes from the edge
                network_node_csv_data.push(node_csv_data[j]);

                var listOfNetworkNodes = [];  
                if(node_csv_ids_to_edge_csv_ids.has(unique_node_csv_data_t[0][j])) {
                    // here already exists in node_csv_ids_to_edge_csv_ids
                    listOfNetworkNodes = node_csv_ids_to_edge_csv_ids.get(unique_node_csv_data_t[0][j]);
                    // so add to end of list of matched csv node ids
                    listOfNetworkNodes.push(all_edge_csv_nodes[i]);
                } else {
                    // here not yet in node_csv_ids_to_edge_csv_ids
                    listOfNetworkNodes.push(all_edge_csv_nodes[i]);
                }
                // update the map with new data
                node_csv_ids_to_edge_csv_ids.set(unique_node_csv_data_t[0][j],listOfNetworkNodes);
            }
        }
    }
}

// process output from hivtrace
function parseHivtraceJSONandGenArrays(data) {
    updateProgress(98, "hivtrace operation completed - starting JSON parse.");
    // process stdout data (containing non-status output form hivtrace)
    if(getNodesAndEdges(data) == 'ok') {
        if(!isBlank(node_csv_file)) {
            console.log(" all_hivtrace_nodes length: " + all_hivtrace_nodes.length );
            var hivtrace_fastas_not_in_csv = difference(all_hivtrace_nodes, unique_node_csv_data_t[0]);
            var output_hivtrace_fastas_not_in_csv = true; // xxxxera
            if(output_hivtrace_fastas_not_in_csv) {
                var yourCallback = function(){};
                fs.writeFile("../debug_json/hivtrace_fastas_not_in_csv.json", JSON.stringify( hivtrace_fastas_not_in_csv ), "utf8", yourCallback );
            }
            if(hivtrace_fastas_not_in_csv.length > 0) {
                var message1 = 'These hivtrace output fasta ids are not in the csv: ' + hivtrace_fastas_not_in_csv.join(', ');
                console.log(message1);
                BootstrapDialog.show({
                    title: 'CSV/HIVTrace Warning', 
                    message: message1, 
                    draggable: true, 
                    closable: true, 
                    type: BootstrapDialog.TYPE_INFO,
                    buttons: [{
                        label: 'Ok',
                        action: function(dialogItself){
                            dialogItself.close();
                        }
                    }]
                });
            }
            gen_hivtrace_maps();
            var output_node_csv_ids_to_edge_csv_ids = true; // xxxxera
            if(output_node_csv_ids_to_edge_csv_ids) {
                var yourCallback = function(){};
                fs.writeFile( "../debug_json/node_csv_ids_to_edge_csv_ids.json", JSON.stringify( node_csv_ids_to_edge_csv_ids ), "utf8", yourCallback );
            }
            var output_network_node_csv_data = true; // xxxxera
            if(output_network_node_csv_data) {
                var yourCallback = function(){};
                fs.writeFile( "../debug_json/network_node_csv_data.json", JSON.stringify( network_node_csv_data ), "utf8", yourCallback );
            }
        }

        // now get edge csv array generated from hivtrace ready
        // to unify hivtrace processing and edge csv file processing put the hivtrace output in edge csv arrays
        edge_csv_data_header = edge_csv_data_w_header[0];
        // take off first row
        edge_csv_data = clone(edge_csv_data_w_header);
        edge_csv_data.splice(0,1);

        // get transpose of array
        edge_csv_data_t = get_transpose(edge_csv_data);

        // get unique column values
        get_unique_column_edge_values();

        // get datatypes for all csv columns
        get_edge_datatypes();

        // get minmax for all csv columns
        get_edge_minmax();

        updateProgress(100, "hivtrace JSON parsing and associated processing complete.");
        setTimeout( doSomethingAfterAWhile, aWhile );
    } else {
        var message9 = 'Problem in parsing hivtrace output!';
        console.log(message9);
        BootstrapDialog.show({
            title: 'HIVTrace Output Error!', 
            message: message9, 
            draggable: true, 
            closable: false, 
            type: BootstrapDialog.TYPE_INFO,
            buttons: [{
                label: 'Ok',
                action: function(dialogItself){
                    dialogItself.close();
                    process.exit(-1);
                }
            }]
        });
    }
}

// This function generates input data for the visjs control from hivtrace output.  
// It also generates auxiliary arrays for use in attribute display
function getNodesAndEdges(data) {
    var ran_hivtrace = true;  // if there is no fasta file, then get network info from 2 csvs
    if(ran_hivtrace) {
        console.log("length of python_data in getNodesAndEdges: " + python_data.length);
        console.log("length of data in getNodesAndEdges: " + data.length);
        // the json data is in the parameter data
        // create a json object with just node ids stripped out
        all_hivtrace_nodes = [];
        all_hivtrace_edges = [];
    
        // pick the node list out of the hivtrace output json
        console.log("about to pick out nodes");
        myNodes = [];
        console.log("data has length: " + data.length);
        var parsePythonJSON = true;
        var myObject;
        console.log("about to parse hivtrace ");
        if(parsePythonJSON)
            myObject = json2Object(python_data); // this way more secure
        else
            myObject = eval('(' + python_data + ')');
        var graphData = myObject.graph;
        var nodeData = graphData.nodes;
        for(var obj in nodeData){
            if(nodeData.hasOwnProperty(obj)){
                for(var prop in nodeData[obj]){
                    if(nodeData[obj].hasOwnProperty(prop)){
                        //console.log(prop + ':' + nodeData[obj][prop]);
                        if(prop == "id") {
                           // for now, make label = id
                           // myNodes.push({"id":nodeData[obj][prop],"label":nodeData[obj][prop]}); don't start out with a label
                           myNodes.push({"id":nodeData[obj][prop]});
                           all_hivtrace_nodes.push(nodeData[obj][prop]);
                        }
                    }
                }
            }
        }
        myEdges = [];
        var id1;
        var id3 = "";
        var from = "";
        var to = "";
        var lengthValue = "";
        var edgeData = graphData["edges"];
        var checkLenTo;
        var checkLenFrom;
        map_fasta_id_min_length = new Map();
        // fill edge_csv_data_w_header
        edge_csv_data_w_header.push( ["id","source","target","length"] );
        for(var obj in edgeData){
            if(edgeData.hasOwnProperty(obj)){
                // reset output holders for new json branch
                to = "";
                from = "";
                lengthValue = "";
                id3 = "";
                for(var prop in edgeData[obj]){
                    if(edgeData[obj].hasOwnProperty(prop)){
                        if(prop == "sequences") {
                            // for now, make label = id
                            id1 = generator.next();
                            id3 = intformat(id1, 'dec');
                            from = edgeData[obj][prop][0];
                            to = edgeData[obj][prop][1];
                            if(lengthValue) {
                                // depending on order to json parts the length can come before or after 'to','from'
                                myEdges.push({"id":id3,"from":from,"to":to,"length":lengthValue});
                                all_hivtrace_edges.push({"id":id3,"from":from, "to":to});
                                edge_csv_data_w_header.push([id3,from,to,lengthValue]);
                                // and fill map_fasta_id_min_length with minimum length for each id
                                checkLenTo = map_fasta_id_min_length.get(to);
                                if(checkLenTo === undefined)
                                    map_fasta_id_min_length.set(to, lengthValue);
                                else if(lengthValue < checkLenTo)
                                    map_fasta_id_min_length.set(to, lengthValue);
                                checkLenFrom = map_fasta_id_min_length.get(from);
                                if(checkLenFrom === undefined)
                                    map_fasta_id_min_length.set(from, lengthValue);
                                else if(lengthValue < checkLenFrom)
                                    map_fasta_id_min_length.set(from, lengthValue);
                            }
                        }
                        if(prop == "length") {
                            lengthValue = edgeData[obj][prop];
                            if(from) {  // if there's a 'from', then there's also a 'to'
                                // depending on order to json parts the length can come before or after 'to','from'
                                myEdges.push({"id":id3,"from":from,"to":to,"length":lengthValue});
                                all_hivtrace_edges.push({"id":id3,"from":from, "to":to});
                                edge_csv_data_w_header.push([id3,from,to,lengthValue]);
                                // and fill map_fasta_id_min_length with minimum length for both to and from
                                checkLenTo = map_fasta_id_min_length.get(to);
                                if(checkLenTo === undefined)
                                    map_fasta_id_min_length.set(to, lengthValue);
                                else if(lengthValue < checkLenTo)
                                    map_fasta_id_min_length.set(to, lengthValue);
                                checkLenFrom = map_fasta_id_min_length.get(from);
                                if(checkLenFrom === undefined)
                                    map_fasta_id_min_length.set(from, lengthValue);
                                else if(lengthValue < checkLenFrom)
                                    map_fasta_id_min_length.set(from, lengthValue);
                            }
                        }
                    }
                }
            }
        }
    } 

    return 'ok';
}

function gen_hivtrace_maps() {
    node_csv_ids_to_edge_csv_ids = new Map(); 
    console.log("creating map from node csv ids to hivtrace fasta ids.");
    // Make a mapping (node_csv_ids_to_edge_csv_ids) from csv fasta ids to 
    // hivtrace outputted FASTA ids in the network. Note: there 
    // can be multiple network nodes for each csv fasta row due 
    // to fasta auto-generated duplicates.
    // Also pare down node_csv_data to only rows output from hivtrace in
    // order to speed up network attribute processing.  This pared down array
    // is network_node_csv_data.
    network_node_csv_data = [];  // all csv rows in the hivtrace output
    for(var j = 0; j < unique_node_csv_data_t[0].length; j++) {
        // hivtrace appends '|DUPLICATE 1' to repeated fasta names
        // re2 matches hivtrace output when it finds a duplicate
        // fasta name
        var temp1 = "\^" + unique_node_csv_data_t[0][j] + "\$";
        //console.log("temp1: " + temp2);
        var temp2 = "\^" + unique_node_csv_data_t[0][j] + ".DUPLICATE[ 0-9]*\$";
        //console.log("temp2: " + temp2);
        //var re1 = new RegExp("\^" + all_hivtrace_nodes[i] + "\$");
        var re1 = new RegExp(temp1);
        //var re2 = new RegExp("^" + all_hivtrace_nodes[i] + "\\|DUPLICATE[ 0-9]*$");
        //var re2 = new RegExp("^" + all_hivtrace_nodes[i] + "\\\\|DUPLICATE[ 0-9]*$");
        //var re2 = new RegExp("\^" + all_hivtrace_nodes[i] + "\\|DUPLICATE[ 0-9]*\$");
        var re2 = new RegExp(temp2);
        //unique_node_csv_data_t[0] contains all the unique csv fasta ids
        for(var i = 0; i < all_hivtrace_nodes.length; i++) {
            // compares all_hivtrace_nodes with csv fasta ids
            if( re1.test(all_hivtrace_nodes[i]) || re2.test(all_hivtrace_nodes[i]) ) {
                // make an array of csv data rows only associated 
                // with output from hivtrace - the jth row of 
                // node_csv_data is an hivtrace output
                network_node_csv_data.push(node_csv_data[j]);

                var listOfNetworkNodes = [];  
                if(node_csv_ids_to_edge_csv_ids.has(all_hivtrace_nodes[i])) {
                    // here already exists in node_csv_ids_to_edge_csv_ids
                    listOfNetworkNodes = node_csv_ids_to_edge_csv_ids.get(all_hivtrace_nodes[i]);
                    // so add to end of list of matched hivtrace 
                    // outputted fasta ids
                    listOfNetworkNodes.push(all_hivtrace_nodes[i]);
                } else {
                    // here not yet in node_csv_ids_to_edge_csv_ids
                    listOfNetworkNodes.push(all_hivtrace_nodes[i]);
                }
                // update the map with new data
                node_csv_ids_to_edge_csv_ids.set(unique_node_csv_data_t[0][j],listOfNetworkNodes);
                //  console.log("adding " + listOfNetworkNodes + " to map for " + unique_node_csv_data_t[0][j] + " re1 is " + re1.test(unique_node_csv_data_t[0][j]) +  " and re2 is " + re2.test(unique_node_csv_data_t[0][j]) + " temp1: " +  temp1 + " temp2: " + temp2 );
            }
        }
    }
}

// default threshold setting for hivtrace
//var threshold = '0.015';  // the threshold sensitivity for the network display
var threshold = '0.015';  // the threshold sensitivity for the network display

// run hivtrace and handle output
var runHivtrace = function() {

    // http://stackoverflow.com/questions/3459476/how-to-append-to-a-file-in-node
    var writeDebugNetworkInput = false;
    if(writeDebugNetworkInput) {
        var fs = require('fs');
        var options = { 'flags': 'a' };
        var logStream = fs.createWriteStream("../debug_json/network.json", options);
    }
    var cwd = process.cwd();
    console.log("current directory is: " + cwd);

    // get the os
    var platform = myos.type();

    if(platform == 'Linux') {
        // for linux 
        var runHivtrace_loc = cwd + "/runHivtrace_linux.sh";
        console.log("runHivtrace loc is: " + runHivtrace_loc);
        var runCmd = runHivtrace_loc + " " + fasta_file + " " + threshold;
        console.log("run command for hivtrace is: " + runCmd);
    } else if(platform == 'Windows_NT') {
        // now adjust path to point to the bash directory
        // assumption is app directory is at same level as cygwin64
        // the following doesn't work due to possibility user will install to
        // something like mtnt_from_setup\app
        // var bash_loc = cwd.slice(0,cwd.indexOf("mtnt\\app")+5) + "cygwin64\\bin\\bash";
        // so count backwards from end of cwd (which will always be the app dir)
        var bash_loc = cwd.slice(0,cwd.length - 3) + "cygwin64\\bin\\bash";
        console.log("bash loc is: " + bash_loc);

        var runHivtrace_loc = replaceAll(cwd, "\\", "/");
        runHivtrace_loc = runHivtrace_loc.replace(":","");
        runHivtrace_loc = '/cygdrive/' + runHivtrace_loc + '/runHivtrace_windows.sh';
        console.log("runHivtrace loc is: " + runHivtrace_loc);
    
        // string to run hivtrace - adjust paths per installation!!!
        // for windows
        var runCmd = bash_loc + ' -l \"' + runHivtrace_loc + '\" \"' + fasta_file + '\"  ' + threshold;
    } else if(platform == 'Darwin') {
    } else {
        console.log("problem with acquisition of operating system.");
        var message1 = "Program Error: unable to determine base operating system.";
        BootstrapDialog.show({
           message: message1,
           type: BootstrapDialog.TYPE_DANGER,
           buttons: [{
               label: 'Exit',
               action: function(dialogItself){
                   dialogItself.close();
                   process.exit(-1);
               }
           }]
        });
    }
    var ls;
    // http://stackoverflow.com/questions/23429499/stdout-buffer-issue-using-node-child-process make buffer 2M
    //ls = childProcess.exec(runCmd, {maxBuffer: 4096 * 2048}, function (error, stdout, stderr) {
    ls = childProcess.exec(runCmd, {maxBuffer: 16384 * 2048}, function (error, stdout, stderr) {
        if(error) {
            console.log(error.stack);
            console.log('Error code: '+error.code);
            console.log('Signal received: '+error.signal);
         }
         console.log('hivtrace calc finished successfully');
    });

    ls.stdout.on('data', function(d) {
        //console.log(d);
        if(writeDebugNetworkInput)
            logStream.write(d);
        python_data = python_data + clone(d);
        console.log("hivtrace data before end marker strip: " + python_data.length);
        var end_loc = python_data.search("~~~xyz789");
        console.log("end_loc is: " + end_loc);
        if(end_loc > -1) {
            console.log("found end of hivtrace output at end_loc: " + end_loc);
            python_data = python_data.substring(0,end_loc - 1);
            ee.emit("stdout", python_data);
            console.log("length of python_data: " + python_data.length)
        }
    });

    ls.stderr.on('data', function(d) {
        console.log(d);
        ee.emit("stderr", d);
    });

    ls.on('exit', function (code) {
        console.log('Child process exited with exit code '+code);
    });

};

function union_arrays (x, y) {
  var obj = {};
  for (var i = x.length-1; i >= 0; -- i)
     obj[x[i]] = x[i];
  for (var i = y.length-1; i >= 0; -- i)
     obj[y[i]] = y[i];
  var res = []
  for (var k in obj) {
    if (obj.hasOwnProperty(k))  // <-- optional
      res.push(obj[k]);
  }
  return res;
}

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

function escapeRegExp(str) {
    return str.replace(/([.*+?\^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function clone(obj) {
    if(obj === null || typeof(obj) !== 'object' || 'isActiveClone' in obj)
        return obj;
    var temp = obj.constructor(); // changed
    for(var key in obj) {
        if(Object.prototype.hasOwnProperty.call(obj, key)) {
            obj['isActiveClone'] = null;
            temp[key] = clone(obj[key]);
            delete obj['isActiveClone'];
        }
    }    
    return temp;
}

function display_detailed_status() {
    // change title on page
    $(".panel-heading h3").text("NetView HIV Processing Status");
    // make the progress bar visible
    document.getElementById('pbar').style.visibility = 'visible';

    // Get the <div> element with id="body"
    var replace_div = document.getElementsByClassName("panel-group");
    removeChilds(replace_div[0]);

    // http://stackoverflow.com/questions/1390319/how-do-i-add-textboxes-dynamically-in-javascript
    // make text box for output of hivtrace 
    var textbox = document.createElement("textarea");
    textbox.setAttribute("readonly","readonly");
    textbox.setAttribute("id","hivtrace_stdout");
    textbox.setAttribute("rows","38");
    textbox.classList.add("form-control");

    var inner_div = document.createElement("div");
    inner_div.classList.add("col-md-12");
    inner_div.classList.add("center");

    inner_div.appendChild(textbox);

    var row_div = document.createElement("div");
    row_div.classList.add("row");

    row_div.appendChild(inner_div);

    var container_div = document.createElement("div");
    container_div.classList.add("container-fluid");

    container_div.appendChild(row_div);

    replace_div[0].appendChild(container_div);
}
 
// http://stackoverflow.com/questions/3955229/remove-all-child-elements-of-a-dom-node-in-javascript
var removeChilds = function (node) {
    var last;
    while (last = node.lastChild) node.removeChild(last);
};

function transpose(arr,arrLen) {
    for (var i = 0; i < arrLen; i++) {
        for (var j = 0; j <i; j++) {
            //swap element[i,j] and element[j,i]
            var temp = arr[i][j];
            arr[i][j] = arr[j][i];
            arr[j][i] = temp;
        }
    }
}

// http://stackoverflow.com/questions/11246758/how-to-get-unique-values-in-an-array
function getUniqueArray(arr) { 
    return $.grep(arr, function (v, i) { 
        return $.inArray(v, arr) === i; 
    }); 
}

// code to update progress bar on status display
function updateProgress(percentage, progressText){
    console.log("updateProgress called with text: " + progressText );
    if(percentage > 100) percentage = 100;
    $('#progressBar').css('width', percentage+'%');
    // $('#progressBar').html(progressText);
    $('#hivtrace_stdout').val($('#hivtrace_stdout').val() + progressText + "\n");
    var psconsole = $('#hivtrace_stdout');
    if(psconsole.length)
        psconsole.scrollTop(psconsole[0].scrollHeight - psconsole.height());
}

// some helper functions for network.html processing

// parse string from hivtrace
function json2Object(jsonString) {
    var parsedData;
    try {
        parsedData = JSON.parse(jsonString);
    } catch(e) {
        if(e.name === 'SyntaxError') {
            console.log(e instanceof SyntaxError); // true
            console.log(e.message);                // "missing ; before statement"
            console.log(e.name);                   // "SyntaxError"
            // exit cause this is very bad
            console.log("about to exit after SyntaxError in JSON.parse");
            var message1 = "There was a parse syntax error in JSON.parse of type: " + e.name + " with detail: " + e.message + ".  Please check your inputs and run hivtrace manually with ptest_(windows,linux,osx).sh for your platform";
            BootstrapDialog.show({
                message: message1,
                type: BootstrapDialog.TYPE_DANGER,
                buttons: [{
                    label: 'Exit',
                    action: function(dialogItself){
                        dialogItself.close();
                        process.exit(-1);
                    }
                }]
            });
        }
    }
    return parsedData;
}

function validateDNA(seqs) {
    //heavily edited on: http://www.blopig.com/blog/2013/03/a-javascript-function-to-validate-fasta-sequences/
    var descr;  // the descriptor of the last processed sequence
    var all_descr = [];
    // immediately remove trailing spaces
    seqs = seqs.trim();
    // split on multiple sequences
    var s = seqs.split('>');
    var arrayLength = s.length;
    var seq;
    for (var i = 1; i < arrayLength; i++) {
         seq = s[i];
         // split on newlines... 
         var lines = seq.split('\n');
         // keep these around in case something is wrong later
         descr = lines[0];
         //console.log("pushing descriptor: " + descr);
         all_descr.push(descr);
         // remove one line (header), starting at the first position 
         lines.splice(0, 1);
         // join the array back into a single string without newlines and 
         // trailing or leading spaces
         seq = lines.join('').trim();
         //Search for charaters that are not IUPAC.
         // http://www.bioinformatics.org/sms/iupac.html
         if (seq.search(/[^ACGTURYSWKMBDHVN\.-]/) != -1) {
             //The seq string contains non-DNA characters
             return { status: 'Problems encountered in sequence ' + i + ' with name: ' + descr, descriptors: all_descr}
         }
    }
    return { status: 'ok', descriptors: all_descr};  // only return if all component sequences are ok
}

// http://stackoverflow.com/questions/9716468/is-there-any-function-like-isnumeric-in-javascript-to-validate-numbers
function testNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

// http://stackoverflow.com/questions/6003884/how-do-i-check-for-null-values-in-javascript
function testNull(n) {
    if( (n === null && typeof n === "object") ||
        (n === "" && typeof n === "string") ||
        (n === undefined && typeof n === "undefined") )
        return true;
    else
        return false;
}

function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}

// get transpose of array
function get_transpose(array) {
    var returnArray;
    returnArray = array[0].map(function(col, i) {
        return array.map(function(row) {
            return row[i]
        })
    });
    return returnArray;
}

// get unique values of all data elements in each column (removes duplicates)
function get_unique_column_node_values() {
    for (var i = 0; i < node_csv_data_t.length; i++) {
        // get unique values within row (which of course used to be a column)
        // these are the unique values in the original csv columns
        unique_node_csv_data_t[i] = getUniqueArray(node_csv_data_t[i]);
    }
}

// get unique values of all data elements in each column (removes duplicates)
function get_unique_column_edge_values() {
    for (var i = 0; i < edge_csv_data_t.length; i++) {
        // get unique values within row (which of course used to be a column)
        // these are the unique values in the original csv columns
        unique_edge_csv_data_t[i] = getUniqueArray(edge_csv_data_t[i]);
    }
}

// get list of numeric columns which contain at least one null
function get_null_col_names() {
    var returnArr = [];
    for (var i = 0; i < node_csv_data_type.length; i++) {
        if(node_csv_data_type[i] == "num_with_null") {
            returnArr.push(node_csv_data_header[i]);
        }
    }
    return returnArr;
}

// fill nulls in node csv data array
function fill_node_nulls() {
    for (var i = 0; i < node_csv_data_t.length; i++) {
        if(node_csv_data_type[i] == "num_with_null") {
            // var max_row = Math.max(unique_node_csv_data_t[i]);
            // var min_row = Math.min(unique_node_csv_data_t[i]);
            // http://stackoverflow.com/questions/11817861/math-min-apply-returns-0-for-null
            var max_row = Math.max.apply(Math, unique_node_csv_data_t[i].map(function(o) {
                return o.y == null ? -Infinity : o.y;
            }));
            var min_row = Math.min.apply(Math, unique_node_csv_data_t[i].map(function(o) {
                return o.y == null ? Infinity : o.y;
            }));

// xxxera - fix to -1
            if(min_row > 0) {
                for(var j = 0; j < node_csv_data_t[i].length; j++) {
                    if( testNull(node_csv_data_t[i][j]) ) 
                        node_csv_data_t[i][j] = "0";
                }
            } else {
                for(var j = 0; j < node_csv_data_t[i].length; j++) {
                    if( testNull(node_csv_data_t[i][j]) ) 
                        node_csv_data_t[i][j] = max_row + 1;
                }
            }
        }
    }
    node_csv_data = get_transpose(node_csv_data_t);
    get_unique_column_node_values();
    get_node_datatypes();
}

// fill nulls in edge csv data array
function fill_edge_nulls() {
    for (var i = 0; i < edge_csv_data_t.length; i++) {
        if(edge_csv_data_type[i] == "num_with_null") {
            // var max_row = Math.max(unique_edge_csv_data_t[i]);
            // var min_row = Math.min(unique_edge_csv_data_t[i]);
            // http://stackoverflow.com/questions/11817861/math-min-apply-returns-0-for-null
            var max_row = Math.max.apply(Math, unique_edge_csv_data_t[i].map(function(o) {
                return o.y == null ? -Infinity : o.y;
            }));
            var min_row = Math.min.apply(Math, unique_edge_csv_data_t[i].map(function(o) {
                return o.y == null ? Infinity : o.y;
            }));

// xxxera - fix to -1
            if(min_row > 0) {
                for(var j = 0; j < edge_csv_data_t[i].length; j++) {
                    if( testNull(edge_csv_data_t[i][j]) ) 
                        edge_csv_data_t[i][j] = "0";
                }
            } else {
                for(var j = 0; j < edge_csv_data_t[i].length; j++) {
                    if( testNull(edge_csv_data_t[i][j]) ) 
                        edge_csv_data_t[i][j] = max_row + 1;
                }
            }
        }
    }
    edge_csv_data = get_transpose(edge_csv_data_t);
    get_unique_column_edge_values();
    get_edge_datatypes();
}

// get datatypes for all csv columns
function get_node_datatypes() {
    var toBeTested;
    var iznull;
    var iznumbr;
    for (var i = 0; i < node_csv_data_t.length; i++) {
        node_csv_data_type[i] = "num";  // default to "num" as the non-exception
        // check values to get the data type ("str" or "num" or "num_with_null")
        for (var j = 0; j < unique_node_csv_data_t[i].length; j++) {
            toBeTested = unique_node_csv_data_t[i][j];
            iznull = testNull(toBeTested);
            iznumbr = testNumber(toBeTested); 

            if ( iznumbr || iznull ) { // this gets both numbers and nulls
                if( iznull )
                    node_csv_data_type[i] = "num_with_null";
            } else {  // not a number or null - therefore string
                node_csv_data_type[i] = "str";
                // console.log("unique_node_csv_data_t with index: " + i + " has array: " + unique_node_csv_data_t[i].toString() + " node_csv_data_type: " + node_csv_data_type[i] + "  iznull: " + iznull + " iznumbr: " + iznumbr );
                // since a single string means not "num" - 
                // no need to check further, so break
                break;
            }
        }
    }
}

// get datatypes for all csv columns
function get_edge_datatypes() {
    var toBeTested;
    var iznull;
    var iznumbr;
    for (var i = 0; i < edge_csv_data_t.length; i++) {
        edge_csv_data_type[i] = "num";  // default to "num" as the non-exception
        // check values to get the data type ("str" or "num" or "num_with_null")
        for (var j = 0; j < unique_edge_csv_data_t[i].length; j++) {
            toBeTested = unique_edge_csv_data_t[i][j];
            iznull = testNull(toBeTested);
            iznumbr = testNumber(toBeTested); 

            if ( iznumbr || iznull ) { // this gets both numbers and nulls
                if( iznull )
                    edge_csv_data_type[i] = "num_with_null";
            } else {  // not a number or null - therefore string
                edge_csv_data_type[i] = "str";
                // console.log("unique_edge_csv_data_t with index: " + i + " has array: " + unique_edge_csv_data_t[i].toString() + " edge_csv_data_type: " + edge_csv_data_type[i] + "  iznull: " + iznull + " iznumbr: " + iznumbr );
                // since a single string means not "num" - 
                // no need to check further, so break
                break;
            }
        }
    }
}

// get minmax for all node csv columns
function get_node_minmax() {
    for (var i = 0; i < node_csv_data_t.length; i++) {
        if(node_csv_data_type[i] == "num") {
            //console.log("inside maxmin" );
            // http://stackoverflow.com/questions/30809656/how-to-avoid-stack-overflow-when-applying-max-to-a-large-array-in-javascript
            //max_node_csv_data.set(i,Math.max.apply(Math,unique_node_csv_data_t[i]));
            //min_node_csv_data.set(i,Math.min.apply(Math,unique_node_csv_data_t[i]));
            // got stack overflow with the below
            var min_value = Infinity; 
            var max_value = -Infinity;
            var value;
            for(var j = 0; j < unique_node_csv_data_t[i].length; j++) {
                value = unique_node_csv_data_t[i][j];
                if(value > max_value) {
                    max_value = value;
                }
                if(value < min_value) {
                    min_value = value;
                }
            }
            max_node_csv_data.set(i,max_value);
            min_node_csv_data.set(i,min_value);
        }
    }
}

// get minmax for all edge csv columns
function get_edge_minmax() {
    for (var i = 0; i < edge_csv_data_t.length; i++) {
        if(edge_csv_data_type[i] == "num") {
            //console.log("inside maxmin" );
            // http://stackoverflow.com/questions/30809656/how-to-avoid-stack-overflow-when-applying-max-to-a-large-array-in-javascript
            // got stack overflow with the below
            //max_edge_csv_data.set(i,Math.max.apply(Math,unique_edge_csv_data_t[i]));
            //min_edge_csv_data.set(i,Math.min.apply(Math,unique_edge_csv_data_t[i]));
            var min_value = Infinity; 
            var max_value = -Infinity;
            var value;
            for(var j = 0; j < unique_edge_csv_data_t[i].length; j++) {
                value = unique_edge_csv_data_t[i][j];
                if(value > max_value) {
                    max_value = value;
                }
                if(value < min_value) {
                    min_value = value;
                }
            }
            max_edge_csv_data.set(i,max_value);
            min_edge_csv_data.set(i,min_value);
        }
    }
}

// http://stackoverflow.com/questions/840781/easiest-way-to-find-duplicate-values-in-a-javascript-array
function unique(array){
  var seen = new Set;
  return array.filter(function(item){
    if (!seen.has(item)) {
      seen.add(item);
      return true;
    }
  });
}

// http://stackoverflow.com/questions/1187518/javascript-array-difference
function difference(a1, a2) {
    var a2Set = new Set(a2);
    return a1.filter(function(x) { return !a2Set.has(x); });
}

// utility function - prints out all properties of an object
var getKeys = function(obj){
    var keys = [];
    for(var key in obj){
        if (obj.hasOwnProperty(key)) {
            keys.push(key);
        }
    }
    return keys;
}

$("#file-0b").fileinput({
    browseClass: "btn btn-primary btn-block",
        showCaption: false,
        showRemove: false,
        showUpload: false,
    browseLabel: "FASTA file"
});
$("#file-0c").fileinput({
    browseClass: "btn btn-primary btn-block",
        showCaption: false,
        showRemove: false,
        showUpload: false,
    browseLabel: "Edge CSV file"
});
$("#file-0a").fileinput({
    browseClass: "btn btn-primary btn-block",
        showCaption: false,
        showRemove: false,
        showUpload: false,
    browseLabel: "Node CSV file"
});

var fs = require('fs');
// https://github.com/wdavidw/node-csv
// http://csv.adaltas.com/parse/examples/
//var csv = require('csv');
var parse = require('csv-parse');
var fasta = require('bionode-fasta');
    
// before anything else gets done, ask the user to accept the legal agreement
var acceptFileName = './accept.txt';
try {
    fs.accessSync(acceptFileName, fs.FS_OK);
} catch (e) {
    // it isn't accessible
    var message3 = 'THE MATERIAL EMBODIED IN THIS SOFTWARE IS PROVIDED TO YOU "AS-IS" AND WITHOUT WARRANTY OF ANY KIND, EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY WARRANTY OF FITNESS FOR A PARTICULAR PURPOSE.  IN NO EVENT SHALL THE CENTERS FOR DISEASE CONTROL AND PREVENTION (CDC) OR THE UNITED STATES (U.S.) GOVERNMENT BE LIABLE TO YOU OR ANYONE ELSE FOR ANY DIRECT, SPECIAL, INCIDENTAL, INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND, OR ANY DAMAGES WHATSOEVER, INCLUDING WITHOUT LIMITATION, LOSS OF PROFIT, LOSS OF USE, SAVINGS OR REVENUE, OR THE CLAIMS OF THIRD PARTIES, WHETHER OR NOT CDC OR THE U.S. GOVERNMENT HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH LOSS, HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, ARISING OUT OF OR IN CONNECTION WITH THE POSSESSION, USE OR PERFORMANCE OF THIS SOFTWARE.  <br><br>Click \'Accept\' to accept this agreement.';
    BootstrapDialog.show({
        title: 'User Acceptance',
        message: message3,
        draggable: true,
        buttons: [{
            label: 'Accept',
            cssClass: 'btn-primary',
            action: function(dialogItself) {
                write_acceptance_file();
                console.log("User accepts legal agreement.");
                dialogItself.close();
            }
       }]
   });
}
    
document.getElementById('main-submit').disabled = true;
    
// write date string to acceptance file
function write_acceptance_file() {
    var now = new Date();
    var outText = "User accepted agreement on " + now.toLocaleDateString() + " at " + now.toLocaleTimeString() + ".";
    fs.writeFile(acceptFileName, outText, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("user legal acceptance file written");
    });
}
    
// handle main-submit click
$("#main-submit").on("click", function () {
    document.getElementById('main-submit').disabled = true;
    console.log("height");
    console.log($(window).height());
    console.log("width");
    console.log($(window).width());
    
    console.log("submit button clicked");
    // $(this).html('validating files...');
    
    node_csv_file = document.getElementById("file-0a").value;
    edge_csv_file = document.getElementById("file-0c").value;
    fasta_file = document.getElementById("file-0b").value;
    
    // this removes the file input gui elements and replaces them with a textarea for detailed status msgs
    display_detailed_status();
    
    if(!isBlank(node_csv_file)) {
        // read entire file into memory synchronously
        var csv_parser_input = fs.readFileSync(node_csv_file).toString();
    
        console.log("Node CSV file read into memory.");
        current_progress = current_progress + 5;
        updateProgress(current_progress, 'Node CSV file read into memory...');
    
        // replace dos or old-mac style line endings - linux (within which python runs) wants unix style
        var pattern = /(\r\n|\n|\r)/gm;
        console.log("length of node csv_parser_input is: " + csv_parser_input.length);
        csv_parser_input = csv_parser_input.replace(pattern,"\n");
        console.log("length of node csv_parser_input after newline processing is: " + csv_parser_input.length);
    
        parse(csv_parser_input, { delimiter: ',' }, function (err, data) {
            if (err != null) {
                console.error(err);
                BootstrapDialog.show({ title: 'Node CSV Parser Error', message: err.message, draggable: true, type: BootstrapDialog.TYPE_DANGER});
            }
    
            // before doing anything else, add an csv_order column
            data[0].push('csv_order');
            for(var i=1; i<data.length; i++)
                data[i].push(i);
    
            node_csv_data_w_header = clone(data);
            if(isBlank(edge_csv_file)) {
                post_parse_node_csv(true);
                useFASTA = true;
            } else { // there is an edge csv file
                
                // read entire file into memory synchronously
                var csv2_parser_input = fs.readFileSync(edge_csv_file).toString();
     
                console.log("Edge CSV file read into memory.");
                current_progress = current_progress + 5;
                updateProgress(current_progress, 'Edge CSV file read into memory...');
     
                // replace dos or old-mac style line endings - linux (within which python runs) wants unix style
                console.log("length of edge csv2_parser_input is: " + csv2_parser_input.length);
                csv2_parser_input = csv2_parser_input.replace(pattern,"\n");
                console.log("length of edge csv2_parser_input after newline processing is: " + csv2_parser_input.length);
     
                parse(csv2_parser_input, { delimiter: ',' }, function (err, data2) {
                    if (err != null) {
                        console.error(err);
                           BootstrapDialog.show({ 
                                title: 'Edge CSV Parser Error', 
                                message: err.message, 
                                draggable: true, 
                                type: BootstrapDialog.TYPE_DANGER,
                            buttons: [{
                                label: 'Close',
                                action: function(dialogItself){
                                    dialogItself.close();
                                    process.exit(-1);
                                }
                            }]
                        });
                    }
    
                    // before doing anything else, add an csv_order column
                    data2[0].push('csv_order');
                    for(var i=1; i<data2.length; i++)
                        data2[i].push(i);
    
                    edge_csv_data_w_header = clone(data2);
                    post_parse_edge_csv(true);
                });
            }
        });
    } else {
        // handle case of blank node csv file - in this case there will be no annotation facilities on the nodes and no datagrid spreadsheet
        if(isBlank(edge_csv_file)) {
            validateFASTArunHivtrace();
            useFASTA = true;
        } else {
            // read entire file into memory synchronously
            var csv2_parser_input = fs.readFileSync(edge_csv_file).toString();
            useFASTA = false;
 
            console.log("Edge CSV file read into memory.");
            current_progress = current_progress + 5;
            updateProgress(current_progress, 'Edge CSV file read into memory...');
 
            // replace dos or old-mac style line endings - linux (within which python runs) wants unix style
            console.log("length of edge csv2_parser_input is: " + csv2_parser_input.length);
            csv2_parser_input = csv2_parser_input.replace(pattern,"\n");
            console.log("length of edge csv2_parser_input after newline processing is: " + csv2_parser_input.length);
 
            parse(csv2_parser_input, { delimiter: ',' }, function (err, data2) {
                if (err != null) {
                    console.error(err);
                    BootstrapDialog.show({ 
                        title: 'Edge CSV Parser Error', 
                        message: err.message, 
                        draggable: true, 
                        type: BootstrapDialog.TYPE_DANGER,
                        buttons: [{
                            label: 'Close',
                            action: function(dialogItself){
                                dialogItself.close();
                                process.exit(-1);
                            }
                        }]
                    });
                }
                edge_csv_data_w_header = clone(data2);
                post_parse_edge_csv(false);
            });
        }
    }
});
    
// handle output data returned from hivtrace call
ee.on("stdout", function (data) {
    console.log("data traffic on stdout");
    updateProgress(95, "hivtrace output processed");
    parseHivtraceJSONandGenArrays(data);
});
    
// Handle status messages (and errors) from hivtrace call.  Note: status messages are mapped to stderr inside altered hivtrace.py
ee.on("stderr", function (data) {
    console.log("data traffic on stderr");
    current_progress = current_progress + 10
    updateProgress(current_progress, "hivtrace status: " + data); // these are only status msgs
});
    
// setup fancy control for node csv fileinput
$("#file-0a").fileinput({
    showUpload: false,
    previewFileType: "text",
    allowedFileExtensions: ["csv", "txt", "text"],
    previewClass: "bg-warning",
    layoutTemplates: {
        main1: "{preview}\n" +
        "<div class=\'input-group {class}\'>\n" +
        "   <div class=\'input-group-btn\'>\n" +
        "       {browse}\n" +
        "       {upload}\n" +
        "       {remove}\n" +
        "   </div>\n" +
        "   {caption}\n" +
        "</div>"
    }
});
    
// setup fancy control for FASTA fileinput
$("#file-0b").fileinput({
    showUpload: false,
    previewFileType: "text",
    allowedFileExtensions: ["fasta", "fas"],
    previewClass: "bg-warning",
    layoutTemplates: {
        main1: "{preview}\n" +
        "<div class=\'input-group {class}\'>\n" +
        "   <div class=\'input-group-btn\'>\n" +
        "       {browse}\n" +
        "       {upload}\n" +
        "       {remove}\n" +
        "   </div>\n" +
        "   {caption}\n" +
        "</div>"
    }
});
    
// setup fancy control for edge csv fileinput
$("#file-0c").fileinput({
    showUpload: false,
    previewFileType: "text",
    allowedFileExtensions: ["csv", "txt", "text"],
    previewClass: "bg-warning",
    layoutTemplates: {
        main1: "{preview}\n" +
        "<div class=\'input-group {class}\'>\n" +
        "   <div class=\'input-group-btn\'>\n" +
        "       {browse}\n" +
        "       {upload}\n" +
        "       {remove}\n" +
        "   </div>\n" +
        "   {caption}\n" +
        "</div>"
    }
});
    
// handle node CSV file selected msg
$("#file-0a").on('fileloaded', function () {
    node_csv_file = document.getElementById("file-0a").value;
    console.log("node_csv_file is following:");
    console.log(node_csv_file);
    if (isBlank(edge_csv_file) && isBlank(fasta_file)) {
        document.getElementById('main-submit').disabled = true;
    } else {
        document.getElementById('main-submit').disabled = false;
    }
});
    
// handle FASTA file selected msg
// http://plugins.krajee.com/file-advanced-usage-demo (see advanced example 7)
$("#file-0b").on('fileloaded', function () {
    // disable the edge CSV file selection
    //$("#file-0c").fileinput('disable').fileinput("refresh", {showUpload: false}); should work 
    $("#file-0c").fileinput('disable');
    $("#file-oc").fileinput('refresh');
    fasta_file = document.getElementById("file-0b").value;
    console.log("fasta_file is following:");
    console.log(fasta_file);
    if (isBlank(edge_csv_file) && isBlank(fasta_file)) {
        document.getElementById('main-submit').disabled = true;
    } else {
        document.getElementById('main-submit').disabled = false;
    }
});
    
// re-enable edge CSV file input after FASTA file selection disabled it
$("#file-0b").on('filecleared', function(event) {
    fasta_file = "";
    console.log("FASTA file cleared");
    // enable the edge CSV file selection
    //$("#file-0c").fileinput('enable').fileinput("refresh", {showUpload: true}); should work
    $("#file-0c").fileinput('enable');
    $("#file-0c").fileinput('refresh');
});
    
// handle edge CSV file selected msg
$("#file-0c").on('fileloaded', function () {
    // clear out the FASTA file selection
    //$("#file-0b").fileinput('disable').fileinput("refresh", {showUpload: false}); should work
    $("#file-0b").fileinput('disable');
    $("#file-0b").fileinput("refresh");
    edge_csv_file = document.getElementById("file-0c").value;
    console.log("edge_csv_file is following:");
    console.log(edge_csv_file);
    if (isBlank(edge_csv_file) && isBlank(fasta_file)) {
        document.getElementById('main-submit').disabled = true;
    } else {
        document.getElementById('main-submit').disabled = false;
    }
});
    
// re-enable FASTA file input after edge CSV file select disabled it
$("#file-0c").on('filecleared', function(event) {
    edge_csv_file = "";
    console.log("edge CSV file cleared");
    // enable the FASTA file selection
    //$("#file-0b").fileinput('enable').fileinput("refresh", {showUpload: true}); should work
    $("#file-0b").fileinput('enable');
    $("#file-0b").fileinput('refresh');
});
