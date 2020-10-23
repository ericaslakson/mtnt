"use strict";
var gui = require('nw.gui');

// Following is all the date that files.js gives the network display.
// Rather then referring to the original location in files.html copy them here.
var node_csv_file;
var edge_csv_file;
var max_node_csv_data;
var max_edge_csv_data;
var min_node_csv_data;
var min_edge_csv_data;
var network_node_csv_data;
var edge_csv_data;  // this is the analogue of network_node_csv_data - however since all edge csv edge create edges there is no reduction from node_csv_data as to network_node_csv_data
var node_csv_data_header;
var edge_csv_data_header;
var node_csv_data_type;
var edge_csv_data_type;
var unique_node_csv_data_t;
var unique_edge_csv_data_t;
var lengthsPresent;
var node_csv_ids_to_edge_csv_ids;
var datatable_data_header;

// defaults
var max_vis_size = 60;
var min_vis_size = 14;

// node selections from edge-object config page 
var nodeLabelSelect; // selected node csv column header name to use for labels
var nodeSizeSelect; // selected node csv column header name to use for sizes
var nodeColorSelect; // selected node csv column header name to use for colors
var nodeShapeSelect; // selected node csv column header name to use for shapes
var nodeOpacitySelect; // selected node csv column header name to use for opacity
var nodeTooltipSelect; // selected node csv column header name to use for tooltips
// the index variations (-1 means not yet chosen)
var nodeLabelCSVIndex = -1; // selected node csv column header index to use for sizes
var nodeSizeCSVIndex = -1; // selected node csv column header index to use for sizes
var nodeColorCSVIndex = -1; // selected node csv column header index to use for colors
var nodeShapeCSVIndex = -1; // selected node csv column header index to use for shapes
var nodeOpacityCSVIndex = -1; // selected node csv column header index to use for opacity
var nodeTooltipCSVIndex = -1; // selected node csv column header index to use for tooltips

var color_edits = new Map(); // a mapping from (node) csv_index, unique_index to chosen color
var edge_color_edits = new Map(); // a mapping from (edge) csv_index, unique_index to chosen color
var shape_edits = new Map(); // a mapping from (node) csv_index, unique_index to chosen shape 
var dash_edits = new Map(); // a mapping from (edge) csv_index, unique_index to chosen dash (index into dashNames)

// edge selections from edge-object config page 
var edgeWidthSelect;  // selected edge csv column header name to use for width 
var edgeColorSelect; // selected edge csv column header name to use for colors
var edgeDashSelect; // selected edge csv column header name to use for shapes
var edgeOpacitySelect; // selected edge csv column header name to use for opacity
var edgeTooltipSelect; // selected edge csv column header name to use for tooltips
// the index variations (-1 means not yet chosen)
var edgeWidthCSVIndex = -1; // selected edge csv column header index to use for sizes
var edgeColorCSVIndex = -1; // selected edge csv column header index to use for colors
var edgeDashCSVIndex = -1; // selected edge csv column header index to use for shapes
var edgeOpacityCSVIndex = -1; // selected edge csv column header index to use for opacity
var edgeTooltipCSVIndex = -1; // selected edge csv column header index to use for tooltips

var network_win = 0;
var histo_win = 0;
var datagrid_win = 0;
var map_win = 0;

var network;
var canvas;
var ctx;
var rect = {};
var drawingSurfaceImageData;
var selectedNodes = [];
   
var myNodes;
var myEdges;
var network_data; // the nodes and edges
var nodes; // the vis nodes object (internal to visjs so that we can access)
var edges; // the vis edges object (internal to visjs so that we can access) 

// default threshold setting for hivtrace
//var threshold = '0.015';  // the threshold sensitivity for the network display
var threshold = '0.015';  // the threshold sensitivity for the network display

// default threshold setting for hivtrace
var sizeScale = '1.000';  // the size scale for the network display

var csv_index;
var allUpdates;

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

// the following functions update the vis display after annotation selection 
function updateNodeLabelSelect(csv_index) {
    console.log("updateNodeLabelSelect() called - csv_index: " + csv_index);
    if(csv_index == "-1") {
        resetVisNodes('label');
        return;
    }
    nodeLabelCSVIndex = csv_index;
    //var allUpdates = { updates: [] };
    allUpdates = { updates: [] };
    var listOfNetworkNodes = [];
    // loop over all csv file rows in the network
    for(var j = 0; j < network_node_csv_data.length; j++) {
        // get list of matching fasta ids for this csv id
        listOfNetworkNodes = node_csv_ids_to_edge_csv_ids.get(network_node_csv_data[j][0]);
        if(listOfNetworkNodes !== undefined) {
            for(var k = 0; k < listOfNetworkNodes.length; k++) {
                allUpdates.updates.push({
                    "id": listOfNetworkNodes[k],
                    "label": network_node_csv_data[j][csv_index]
                });
            }
        }
    }
    // nodes.update(allUpdates.updates);
    nodeUpdateWithError(nodes, allUpdates);
}

function nodeUpdateWithError(nodes, allUpdates) {
    try {
        nodes.update(allUpdates.updates);
    } catch(err) {
        console.log(err)
    }
}

function edgeUpdateWithError(edges, allUpdates) {
    try {
        edges.update(allUpdates.updates);
    } catch(err) {
        console.log(err)
    }
}

function updateNodeSizeSelect(csv_index) {
    // console.log("updateNodeSizeSelect() called - csv_index: " + csv_index);
    if(csv_index == "-1") {
        resetVisNodes('size');
        return;
    }
    nodeSizeCSVIndex = csv_index;
    //var allUpdates = { updates: [] };
    allUpdates = { updates: [] };
    var listOfNetworkNodes = [];
    var min_csv = min_node_csv_data.get(Number(csv_index));
    var max_csv = max_node_csv_data.get(Number(csv_index));
    if( max_csv > min_csv ) {
        var scale = ((sizeScale * max_vis_size) - min_vis_size) / (max_csv - min_csv);
        // console.log("sizeScale is: " + sizeScale + " scale is: " + scale);
        // loop over all csv file rows in the network
        for(var j = 0; j < network_node_csv_data.length; j++) {
            // get list of matching fasta ids for this csv id
            listOfNetworkNodes = node_csv_ids_to_edge_csv_ids.get(network_node_csv_data[j][0]);
            if(listOfNetworkNodes !== undefined) {
                for(var k = 0; k < listOfNetworkNodes.length; k++) {
                    //console.log("node_csv_data is:" + network_node_csv_data[j][csv_index] + " size value: " + Math.max(min_vis_size,(network_node_csv_data[j][csv_index] - min_csv)*scale + min_vis_size));
                    allUpdates.updates.push({
                        "id": listOfNetworkNodes[k],
                        "size": Math.max(min_vis_size,(network_node_csv_data[j][csv_index] - min_csv)*scale + min_vis_size)
                    });
                }
            }
        }
        //console.log("about to update sizes with command: " + JSON.stringify(allUpdates.updates).toString());
        // nodes.update(allUpdates.updates);
        nodeUpdateWithError(nodes, allUpdates);
    }
}

function updateEdgeWidthSelect(csv_index) {
    console.log("updateEdgeWidthSelect() called - csv_index: " + csv_index);
    if(csv_index == "-1") {
        resetVisEdges('width');
        return;
    }
    edgeWidthCSVIndex = csv_index;
    //var allUpdates = { updates: [] };
    allUpdates = { updates: [] };
    var max_vis_width = 8;
    var min_vis_width = 1;
    var min_csv = min_edge_csv_data.get(Number(csv_index));
    var max_csv = max_edge_csv_data.get(Number(csv_index));
    if( max_csv > min_csv ) {
        var scale = (max_vis_width - min_vis_width) / (max_csv - min_csv);
        // loop over all csv file rows in the network
        for(var j = 0; j < edge_csv_data.length; j++) {
            allUpdates.updates.push({
                "id": edge_csv_data[j][0],
                "width": Math.max(min_vis_width,(edge_csv_data[j][csv_index] - min_csv)*scale + min_vis_width)
            });
        }
        //console.log("about to update width with command: " + JSON.stringify(allUpdates.updates).toString());
        edgeUpdateWithError(edges, allUpdates);
    }
}

function updateNodeColorSelect2(csv_index,unique_index,color_index) {
    nodeColorCSVIndex = csv_index;
    //console.log("updateNodeColorSelect2() called - csv_index: " + csv_index + ", unique_index: " + unique_index + ", color_index: " + color_index);
    // store this edit of the color output of this csv_index, unique_index in
    // a map so it will be applied next time this csv_index is selected.
    //console.log("storing color_edits with value: " + convertHex(rgb2hex(colors[color_index]),100) + " with csv_index: " + csv_index + " unique_index: " + unique_index);
    color_edits.set(csv_index + '_' + unique_index, color_index); 
    // should only update this value of csv_index, unique_index but in the 
    // interest of code simplicity (and because update is quick anyway) 
    // update all unique_index values with below call
    updateNodeColorOpacitySelect(csv_index,nodeOpacityCSVIndex);
    // if you change all the colors then you must change the color names if displayed
    if(nodeTooltipCSVIndex == "-2") {
         updateNodeTooltipColorNames(nodeColorCSVIndex, nodeTooltipCSVIndex);
    }
}

function updateEdgeColorSelect2(csv_index,unique_index,color_index) {
    edgeColorCSVIndex = csv_index;
    //console.log("updateEdgeColorSelect2() called - csv_index: " + csv_index + ", unique_index: " + unique_index + ", color_index: " + color_index);
    // store this edit of the color output of this csv_index, unique_index in
    // a map so it will be applied next time this csv_index is selected.
    //console.log("storing edge_color_edits with value: " + convertHex(rgb2hex(colors[color_value]),100) + " with csv_index: " + csv_index + " unique_index: " + unique_index);
    edge_color_edits.set(csv_index + '_' + unique_index, color_index); 
    // should only update this value of csv_index, unique_index but in the 
    // interest of code simplicity (and because update is quick anyway) 
    // update all unique_index values with below call
    updateEdgeColorOpacitySelect(csv_index,edgeOpacityCSVIndex);
    // if you change all the edge colors then you must change the color names if displayed
    if(edgeTooltipCSVIndex == "-2") {
         updateEdgeTooltipColorNames(edgeColorCSVIndex, edgeTooltipCSVIndex);
    }
}

function updateNodeShapeSelect2(csv_index,unique_index,shape_index) {
    nodeShapeCSVIndex = csv_index;
    console.log("updateNodeShapeSelect2() called - csv_index: " + csv_index + ", unique_index: " + unique_index + ", shape_index: " + shape_index);
    // store this edit of the shape output of this csv_index, unique_index in
    // a map so it will be applied next time this csv_index is selected.
    var shape_text = shapeNames[shape_index];
    //console.log("storing shape_edits with value: " + shape_text + " with csv_index: " + csv_index + " unique_index: " + unique_index);
    shape_edits.set(csv_index + '_' + unique_index, shape_text); 
    //var allUpdates = { updates: [] };
    allUpdates = { updates: [] };
    var listOfNetworkNodes = [];
    // loop over all csv file rows in the network
    for(var j = 0; j < network_node_csv_data.length; j++) {
        // change all the values with index csv_index and unique_index
        if(network_node_csv_data[j][csv_index]==unique_node_csv_data_t[csv_index][unique_index]){
            // get list of matching fasta ids for this csv id
            listOfNetworkNodes = node_csv_ids_to_edge_csv_ids.get(network_node_csv_data[j][0]);
            if(listOfNetworkNodes !== undefined) {
                for(var k = 0; k < listOfNetworkNodes.length; k++) {
                    allUpdates.updates.push({
                        "id": listOfNetworkNodes[k],
                        "shape": shape_text
                    });
                }
            }
        }
    }
    // nodes.update(allUpdates.updates);
    nodeUpdateWithError(nodes, allUpdates);
}

function updateEdgeDashSelect2(csv_index,unique_index,dash_index) {
    edgeDashCSVIndex = csv_index;
    console.log("updateEdgeDashSelect2() called - csv_index: " + csv_index + ", unique_index: " + unique_index + ", dash_index: " + dash_index);
    // store this edit of the dash selection of this csv_index, unique_index in
    // a map so it will be applied next time this csv_index is selected.
    var dash_spec = dashSpecs[dash_index];
    //console.log("storing dash_edits with value: " + dash_spec + " with csv_index: " + csv_index + " unique_index: " + unique_index);
    dash_edits.set(csv_index + '_' + unique_index, dash_spec); 
    allUpdates = { updates: [] };
    // loop over all csv file rows in the network
    for(var j = 0; j < edge_csv_data.length; j++) {
        // change all the values with index csv_index and unique_index xxxera
        if(edge_csv_data[j][csv_index]==unique_edge_csv_data_t[csv_index][unique_index]){
            allUpdates.updates.push({
                "id": edge_csv_data[j][0],
                "dashes": dash_spec
            });
        }
    }
    edgeUpdateWithError(edges, allUpdates);
}

function updateNodeShapeSelect1(csv_index) {
    console.log("updateNodeShapeSelect1() called - csv_index: " + csv_index);
    if(csv_index == "-1") {
        resetVisNodes('shape');
        return;
    }
    nodeShapeCSVIndex = csv_index;
    //var allUpdates = { updates: [] };
    allUpdates = { updates: [] };
    var listOfNetworkNodes = [];
    // loop over all csv file rows in the network
    for(var j = 0; j < network_node_csv_data.length; j++) {
        // loop over all the values in this column (with index csv_index)
        for(var i = 0; i < unique_node_csv_data_t[csv_index].length; i++) {
            if(network_node_csv_data[j][csv_index]==unique_node_csv_data_t[csv_index][i]){
                // get list of matching fasta ids for this csv id
                listOfNetworkNodes = node_csv_ids_to_edge_csv_ids.get(network_node_csv_data[j][0]);
                // if shape_to_set for this csv_index and unique_index has an entry, the shape associated with this unique_index has been edited, 
                // set the the previously edited value for shape here
                var shape_to_set;
                if(shape_edits.has(csv_index + '_' + i)) {
                    shape_to_set = shape_edits.get(csv_index + '_' + i);
                    //console.log("using stored shape_edits with value: " + shape_to_set + " with csv_index: " + csv_index + " unique_index: " + i);
                } else {
                    shape_to_set = shapeNames[i];
                } 
                if(listOfNetworkNodes !== undefined) {
                    for(var k = 0; k < listOfNetworkNodes.length; k++) {
                        allUpdates.updates.push({
                            "id": listOfNetworkNodes[k],
                            "shape": shape_to_set
                        });
                    }
                } 
                break;  // break out of inner for loop if found match
            }
        }
    }
    // nodes.update(allUpdates.updates);
    nodeUpdateWithError(nodes, allUpdates);
}

function updateEdgeDashSelect1(csv_index) {
    console.log("updateEdgeDashSelect1() called - csv_index: " + csv_index);
    if(csv_index == "-1") {
        resetVisEdges('dashes');
        return;
    }
    edgeDashCSVIndex = csv_index;
    //var allUpdates = { updates: [] };
    allUpdates = { updates: [] };
    // loop over all edge csv file rows in the network
    for(var j = 0; j < edge_csv_data.length; j++) {
        // loop over all the values in this column (with index csv_index)
        for(var i = 0; i < unique_edge_csv_data_t[csv_index].length; i++) {
            if(edge_csv_data[j][csv_index]==unique_edge_csv_data_t[csv_index][i]){
                // if shape for this csv_index, unique_index has been edited, 
                // set the the previously edited value for shape here
                var dash_to_set;
                if(dash_edits.has(csv_index + '_' + i)) {
                    dash_to_set = dash_edits.get(csv_index + '_' + i);
                    //console.log("using stored dash_edits with value: " + dash_to_set + " with csv_index: " + csv_index + " unique_index: " + i);
                } else {
                    dash_to_set = dashSpecs[i];
                } 
                allUpdates.updates.push({
                    id: edge_csv_data[j][0],
                    dashes: dash_to_set
                });
                break;  // break out of inner for loop if found match
            }
        }
    }
    edgeUpdateWithError(edges, allUpdates);
}

function updateNodeColorSelect1(csv_index) {
    nodeColorCSVIndex = csv_index;
    console.log("updateNodeColorSelect1() called - csv_index: " + csv_index);
    updateNodeColorOpacitySelect(csv_index,nodeOpacityCSVIndex);
    // if you change all the colors then you must change the color names if displayed
    if(nodeTooltipCSVIndex == "-2") {
         updateNodeTooltipColorNames(nodeColorCSVIndex, nodeTooltipCSVIndex);
    }
}

function updateEdgeColorSelect1(csv_index) {
    edgeColorCSVIndex = csv_index;
    console.log("updateEdgeColorSelect1() called - csv_index: " + csv_index);
    updateEdgeColorOpacitySelect(csv_index,edgeOpacityCSVIndex);
    // if you change all the edge colors then you must change the edge color names if displayed
    if(edgeTooltipCSVIndex == "-2") {
         updateEdgeTooltipColorNames(edgeColorCSVIndex, edgeTooltipCSVIndex);
    }
}

function updateNodeColorOpacitySelect(color_csv_index, opacity_csv_index) {
    //var allUpdates = { updates: [] };
    allUpdates = { updates: [] };
    var listOfNetworkNodes = [];
    var color_index_to_set;
    var color_to_set;
    var border_color_to_set;
    var opacity_to_set = 1; // default opacity is 1
    if(opacity_csv_index >= 0) { // if -1 means has not been selected
        var max_opacity = 1;
        var min_opacity = 0;
        var min_csv = min_node_csv_data.get(Number(opacity_csv_index));
        var max_csv = max_node_csv_data.get(Number(opacity_csv_index));
        // check that max_csv > min_csv is already done in network.html
        // xxxera - check for max_csv=min_csv
        var scale = (max_opacity - min_opacity) / (max_csv - min_csv);
    }
    if(color_csv_index >= 0) {
        // loop over all csv file rows in the network
        for(var j = 0; j < network_node_csv_data.length; j++) {
            if(opacity_csv_index >= 0) // if this is called from resetVisNodes reset then opacity_csv_index == -1
                opacity_to_set = Math.max(min_opacity,(network_node_csv_data[j][opacity_csv_index] - min_csv)*scale + min_opacity);
            // loop over all the values in this column (with index color_csv_index)
            for(var i = 0; i < unique_node_csv_data_t[color_csv_index].length; i++) {
                if(network_node_csv_data[j][color_csv_index]==unique_node_csv_data_t[color_csv_index][i]){
                    // get list of matching fasta ids for this csv id
                    // network_node_csv_data[j][0] are the fasta ids in the network array
                    listOfNetworkNodes = node_csv_ids_to_edge_csv_ids.get(network_node_csv_data[j][0]);
                    // if color_edits for this color_csv_index and unique index has data, then the coloring for this unique_index has been edited, 
                    // set the the previously edited value for color here
                    if(color_edits.has(color_csv_index + '_' + i)) {
                        color_index_to_set = color_edits.get(color_csv_index + '_' + i);
                        //console.log("using stored color_edits with index: " + color_index_to_set + " with csv_index: " + color_csv_index + " and unique_index: " + i);
                        color_to_set = colors[color_index_to_set];
                    } else {
                        color_to_set = colors[i];
                    } 
                    // if no overlap between csv and fasta, then skip xxxera
                    if(listOfNetworkNodes !== undefined) {
                        for(var k = 0; k < listOfNetworkNodes.length; k++) {
                            // combine color and opacity
                            color_to_set = color_to_set.replace(/[\d\.]+\)$/g,opacity_to_set + ')')
                            // xxxera fix edge of node object http://stackoverflow.com/questions/31183085/how-to-update-a-node-or-edge-property-of-visjs-using-angularjs
                            // check if node color is black
                            if(color_to_set.search("25,25,25") == -1) {
                                allUpdates.updates.push({
                                    "id": listOfNetworkNodes[k],
                                    "color": color_to_set
                                });
                            } else {
                                // change font color to white if node color is black
                                allUpdates.updates.push({
                                    "id": listOfNetworkNodes[k],
                                    "color": color_to_set,
                                    "font": { "color": 'white' }
                                });
                            }
                        }
                    }
                    break;  // break out of inner for loop if found match
                }
            }
        }
    } else {  // here color is being reset to default (but opacity may not be being reset at the same time)
        // loop over all csv file rows in the network
        for(var j = 0; j < network_node_csv_data.length; j++) {
            if(opacity_csv_index >= 0) // if this is called from resetVisNodes reset then opacity_csv_index == -1
                opacity_to_set = Math.max(min_opacity,(network_node_csv_data[j][opacity_csv_index] - min_csv)*scale + min_opacity);
            color_to_set = 'rgba(151,194,252,' + opacity_to_set + ')'; //rgb value from color pick
            border_color_to_set = 'rgba(46,126,233,' + opacity_to_set + ')'; // rgb value from color pick
            // xxxera not sure if this default color is right http://visjs.org/docs/network/manipulation.html - this is a wrong color
            // get list of matching fasta ids for this csv id
            // network_node_csv_data[j][0] are the fasta ids in the network array
            listOfNetworkNodes = node_csv_ids_to_edge_csv_ids.get(network_node_csv_data[j][0]);
            if(listOfNetworkNodes !== undefined) {
                for(var k = 0; k < listOfNetworkNodes.length; k++) {
                    allUpdates.updates.push({
                        "id": listOfNetworkNodes[k],
                        "color": { 
                            "background": color_to_set,
                            "border": border_color_to_set,
                            "highlight": {
                                "background": color_to_set,
                                "border": border_color_to_set
                            }
                        },
                        "borderWidth": 1,
                        "borderWidthSelected": 4
                    });
                }
            }
        }
    }
    // console.log("about to update with command: " + JSON.stringify(allUpdates.updates).toString());
    // nodes.update(allUpdates.updates);
    nodeUpdateWithError(nodes, allUpdates);
}

function updateEdgeColorOpacitySelect(color_csv_index, opacity_csv_index) {
    // console.log("updateEdgeColorOpacitySelect called with color_csv_index: " + color_csv_index + " and opacity_csv_index: " + opacity_csv_index + " and threshold: " + threshold);
    allUpdates = { updates: [] };
    var color_to_set;
    var color_index_to_set;
    var opacity_to_set = 1; // default opacity is 1
    var threshold_opacity_to_set = 0; // make invisible if above threshold
    if(opacity_csv_index >= 0) { // if -1 means has not been selected
        var max_opacity = 1;
        var min_opacity = 0;
        var min_csv = min_edge_csv_data.get(Number(opacity_csv_index));
        var max_csv = max_edge_csv_data.get(Number(opacity_csv_index));
        // check that max_csv > min_csv is already done in network.html
        // xxxera - check for max_csv=min_csv
        var scale = (max_opacity - min_opacity) / (max_csv - min_csv);
    }
    if(color_csv_index >= 0) {
        // loop over all csv file rows in the network
        for(var j = 0; j < edge_csv_data.length; j++) {
            if(opacity_csv_index >= 0) // if this is called from resetVisEdges reset then opacity_csv_index == -1
                opacity_to_set = Math.max(min_opacity,(edge_csv_data[j][opacity_csv_index] - min_csv)*scale + min_opacity);
            // loop over all the values in this column (with index color_csv_index)
            for(var i = 0; i < unique_edge_csv_data_t[color_csv_index].length; i++) {
                if(edge_csv_data[j][color_csv_index]==unique_edge_csv_data_t[color_csv_index][i]){
                    // edge_csv_data[j][0] are the unique ids in the network array
                    // if edge_color_edits for this color_csv_index and unique_index has data, then the coloring for the data with this unique_index has been edited, 
                    // set the the previously edited value for color here
                    if(edge_color_edits.has(color_csv_index + '_' + i)) {
                        color_index_to_set = edge_color_edits.get(color_csv_index + '_' + i);
                        //console.log("using edge_color_edits with index: " + color_index_to_set + " with csv_index: " + color_csv_index + " and unique_index: " + i);
                        color_to_set = colors[color_index_to_set];
                    } else {
                        color_to_set = colors[i];
                    } 
                    // combine color and opacity
                    color_to_set = color_to_set.replace(/[\d\.]+\)$/g, opacity_to_set + ')')
                    // adjust opacity for threshold
                    if( useFASTA ) {
                        if(edge_csv_data[j][3] > threshold) {
                            // combine color and opacity
                            color_to_set = color_to_set.replace(/[\d\.]+\)$/g,threshold_opacity_to_set + ')')
                        }
                    }
                    allUpdates.updates.push({
                        "id": edge_csv_data[j][0],
                        "color": color_to_set
                    });
                    break;  // break out of inner for loop if found match
                }
            }
        }
    } else {  // here color is being reset to default (but opacity may not be being reset at the same time)
        // loop over all csv file rows in the network
        for(var j = 0; j < edge_csv_data.length; j++) {
            if(opacity_csv_index >= 0) // if this is called from resetVisNodes reset then opacity_csv_index == -1
                opacity_to_set = Math.max(min_opacity,(edge_csv_data[j][opacity_csv_index] - min_csv)*scale + min_opacity);
            color_to_set = 'rgba(151,194,252,' + opacity_to_set + ')'; // rgb value from color pick
            // adjust opacity for threshold
            if( useFASTA ) {
                if(edge_csv_data[j][3] > threshold) {
                    // combine color and opacity
                    color_to_set = color_to_set.replace(/[\d\.]+\)$/g,threshold_opacity_to_set + ')')
                }
            }
            allUpdates.updates.push({
                "id": edge_csv_data[j][0],
                "color": color_to_set,
                "width": 2,
                "selectionWidth": 3
            });
        }
    }
    // console.log("about to update with command: " + JSON.stringify(allUpdates.updates).toString());
    edgeUpdateWithError(edges, allUpdates);
}

function updateNodeOpacitySelect(csv_index) {
    nodeOpacityCSVIndex = csv_index;
    // console.log("updateNodeOpacitySelect() called with csv_index: " + csv_index + " and nodeColorCSVIndex: " + nodeColorCSVIndex);
    updateNodeColorOpacitySelect(nodeColorCSVIndex,csv_index);
}

function updateEdgeOpacitySelect(csv_index) {
    edgeOpacityCSVIndex = csv_index;
    console.log("updateEdgeOpacitySelect() called with csv_index: " + csv_index + " and edgeColorCSVIndex: " + edgeColorCSVIndex);
    updateEdgeColorOpacitySelect(edgeColorCSVIndex,csv_index);
}

function updateNodeTooltipSelect(tooltip_csv_index) {
    nodeTooltipCSVIndex = tooltip_csv_index;
    // console.log("updateNodeTooltipSelect() called - tooltip_csv_index: " + tooltip_csv_index);
    if((tooltip_csv_index == "-1") || (tooltip_csv_index == "-2")) {
        updateNodeTooltipColorNames(nodeColorCSVIndex, tooltip_csv_index);
        return;
    }
    //var allUpdates = { updates: [] };
    allUpdates = { updates: [] };
    var listOfNetworkNodes = [];
    // loop over all csv file rows in the network
    for(var j = 0; j < network_node_csv_data.length; j++) {
        // get list of matching fasta ids for this csv id
        listOfNetworkNodes = node_csv_ids_to_edge_csv_ids.get(network_node_csv_data[j][0]);
        if(listOfNetworkNodes !== undefined) {
            for(var k = 0; k < listOfNetworkNodes.length; k++) {
                allUpdates.updates.push({
                    "id": listOfNetworkNodes[k],
                    "title": network_node_csv_data[j][tooltip_csv_index]
                });
            }
        }
    }
    // nodes.update(allUpdates.updates);
    nodeUpdateWithError(nodes, allUpdates);
}

// This function clears the tooltips.  Due to a 'peculiarity' in visjs, clearing a tooltip (setting the title null) should
// only be done for nodes that have an existing tooltip.  If one sends a null to a node without a pre-existing tooltip, then an empty blank box appears.
// not used presently
function resetTooltipSelect(tooltip_csv_index) {
    nodeTooltipCSVIndex = tooltip_csv_index;
    console.log("resetTooltipSelect() called - tooltip_csv_index: " + tooltip_csv_index);
    if((tooltip_csv_index == "-1") || (tooltip_csv_index == "-2")) {
        updateNodeTooltipColorNames(nodeColorCSVIndex, tooltip_csv_index);
        return;
    }
    allUpdates = { updates: [] };
    var listOfNetworkNodes = [];
    // loop over all csv file rows that have nodes in the network
    for(var j = 0; j < network_node_csv_data.length; j++) {
        // get list of matching hivtrace output fasta ids for this csv row
        listOfNetworkNodes = node_csv_ids_to_edge_csv_ids.get(network_node_csv_data[j][0]);
        if(listOfNetworkNodes !== undefined) {
            for(var k = 0; k < listOfNetworkNodes.length; k++) {
                allUpdates.updates.push({
                    "id": listOfNetworkNodes[k],
                    "title": null
                });
            }
        }
    }
    // nodes.update(allUpdates.updates);
    nodeUpdateWithError(nodes, allUpdates);
}

// This function sets and clears node tooltip color names.  According to the visjs docs, sending a null title to a node clears
// any existing tooltip.  If this is done to a node without previous tooltip text, then a small empty box appears.  The workaround
// solution implemented in this code is to clear only nodes that have existing tooltip names.  If the nodes tooltip color names are to be 
// cleared then tooltip_csv_index has a "-1".  color_csv_index contains the index of the csv column used for coloring.
function updateNodeTooltipColorNames(color_csv_index, tooltip_csv_index) {
    //var allUpdates = { updates: [] };
    allUpdates = { updates: [] };
    var listOfNetworkNodes = [];
    var color_index_to_set;
    if(color_csv_index >= 0) {
        // loop over all csv file rows in the network
        for(var j = 0; j < network_node_csv_data.length; j++) {
            // loop over all the values in this column (with index color_csv_index)
            for(var i = 0; i < unique_node_csv_data_t[color_csv_index].length; i++) {
                if(network_node_csv_data[j][color_csv_index]==unique_node_csv_data_t[color_csv_index][i]){
                    // get list of matching fasta ids for this csv id
                    // network_node_csv_data[j][0] are the fasta ids in the network array
                    listOfNetworkNodes = node_csv_ids_to_edge_csv_ids.get(network_node_csv_data[j][0]);
                    // if color_edits for this color_csv_index and unique_index had data, then the coloring for the data with this unique_index has been edited, 
                    // set the the previously edited value for color here
                    if(color_edits.has(color_csv_index + '_' + i)) {
                        color_index_to_set = color_edits.get(color_csv_index + '_' + i);
                        //console.log("using stored color_edits with value: " + color_index_to_set + " with csv_index: " + color_csv_index + " and unique_index: " + i);
                    } else {
                        color_index_to_set = i;
                    } 
                    // if no overlap between csv and fasta, then skip xxxera
                    if(listOfNetworkNodes !== undefined) {
                        for(var k = 0; k < listOfNetworkNodes.length; k++) {
                            if(tooltip_csv_index == "-1") {
                                allUpdates.updates.push({
                                    "id": listOfNetworkNodes[k],
                                    "title": null
                                });
                            } else {
                                allUpdates.updates.push({
                                    "id": listOfNetworkNodes[k],
                                    "title": colorNames[color_index_to_set]
                                });
                            }
                        }
                    }
                    break;  // break out of inner for loop if found match
                }
            }
        }
    } 
    // console.log("about to update with command: " + JSON.stringify(allUpdates.updates).toString());
    // nodes.update(allUpdates.updates);
    nodeUpdateWithError(nodes, allUpdates);
}

// This function is a variation of updateNodeTooltipColorNames but only works on a single unique_index.  Please see the explanatory notes for
// updateNodeTooltipColorNames.  unique_index is an index into an array containing a list of unique values within a single network_node_csv_data column.
// currently not used
function updateNodeTooltipColorNames2(color_csv_index, tooltip_csv_index, unique_index) {
    //var allUpdates = { updates: [] };
    allUpdates = { updates: [] };
    var listOfNetworkNodes = [];
    var color_index_to_set;
    if(color_csv_index >= 0) {
        // loop over all csv file rows in the network
        for(var j = 0; j < network_node_csv_data.length; j++) {
            if(network_node_csv_data[j][color_csv_index]==unique_node_csv_data_t[color_csv_index][unique_index]){
                // get list of matching fasta ids for this csv id
                // network_node_csv_data[j][0] are the fasta ids in the network array
                listOfNetworkNodes = node_csv_ids_to_edge_csv_ids.get(network_node_csv_data[j][0]);
                // if color for this color_csv_index and unique_index has data, the coloring for the data with this unique_index has been edited, 
                // set the the previously edited value for color here
                if(color_edits.has(color_csv_index + '_' + unique_index)) {
                    color_index_to_set = color_edits.get(color_csv_index + '_' + unique_index);
                    //console.log("using stored color_edits with value: " + color_index_to_set + " with csv_index: " + color_csv_index + " and unique_index: " + i);
                } else {
                    color_index_to_set = unique_index;
                } 
                // if no overlap between csv and fasta, then skip xxxera
                if(listOfNetworkNodes !== undefined) {
                    for(var k = 0; k < listOfNetworkNodes.length; k++) {
                        if(tooltip_csv_index == "-1") {
                            allUpdates.updates.push({
                                "id": listOfNetworkNodes[k],
                                "title": null
                            });
                        } else {
                            allUpdates.updates.push({
                                "id": listOfNetworkNodes[k],
                                "title": colorNames[color_index_to_set]
                            });
                        }
                    }
                }
                break;  // break out of inner for loop if found match
            }
        }
    } 
    // console.log("about to update with command: " + JSON.stringify(allUpdates.updates).toString());
    // nodes.update(allUpdates.updates);
    nodeUpdateWithError(nodes, allUpdates);
}

function updateEdgeTooltipSelect(tooltip_csv_index) {
    console.log("updateEdgeTooltipSelect() called - tooltip_csv_index: " + tooltip_csv_index);
    if(tooltip_csv_index == "-1") {  // this means reset
        // if the previously selected tooltip was color name, then handle separately
        if(edgeTooltipCSVIndex == "-2") { // edgeTooltipCSVIndex is the previous value as it has not been reset
            updateEdgeTooltipColorNames(edgeColorCSVIndex,tooltip_csv_index);
            return;
        } else {
            resetEdgeTooltipSelect()
            return;
        }
    }
    edgeTooltipCSVIndex = tooltip_csv_index;
    if (tooltip_csv_index == "-2") {
        updateEdgeTooltipColorNames(edgeColorCSVIndex, tooltip_csv_index);
        return;
    }
    //var allUpdates = { updates: [] };
    allUpdates = { updates: [] };
    // loop over all edge csv file rows in the network
    for(var j = 0; j < edge_csv_data.length; j++) {
        allUpdates.updates.push({
            "id": edge_csv_data[j][0],
            "title": edge_csv_data[j][tooltip_csv_index]
        });
    }
    edgeUpdateWithError(edges, allUpdates);
}

// this resets the tooltips for non color name tooltips
function resetEdgeTooltipSelect() {
    console.log("resetEdgeTooltipSelect() called");
    //var allUpdates = { updates: [] };
    allUpdates = { updates: [] };
    // loop over all edge csv file rows in the network
    for(var j = 0; j < edge_csv_data.length; j++) {
        allUpdates.updates.push({
            "id": edge_csv_data[j][0],
            "title": null
        });
    }
    edgeUpdateWithError(edges, allUpdates);
}

function updateEdgeTooltipColorNames(color_csv_index, tooltip_csv_index) {
    allUpdates = { updates: [] };
    var color_to_set;
    var color_index_to_set;
    var color;
    if(color_csv_index >= 0) {
        // loop over all csv file rows in the network
        for(var j = 0; j < edge_csv_data.length; j++) {
            // loop over all the values in this column (with index color_csv_index)
            for(var i = 0; i < unique_edge_csv_data_t[color_csv_index].length; i++) {
                if(edge_csv_data[j][color_csv_index]==unique_edge_csv_data_t[color_csv_index][i]){
                    // edge_csv_data[j][0] are the unique ids in the network array
                    // if edge_color_edits for this color_csv_index and unique_index 
                    // has data, then the coloring for the data with this unique_index has been edited, 
                    // set the the previously edited value for color here
                    if(edge_color_edits.has(color_csv_index + '_' + i)) {
                        color_index_to_set = edge_color_edits.get(color_csv_index + '_' + i);
                        //console.log("using edge_color_edits with index: " + color_index_to_set + " with csv_index: " + color_csv_index + " and unique_index: " + i);
                        color = colorNames[color_index_to_set];
                    } else {
                        color = colorNames[i];
                    } 
                    if(tooltip_csv_index == "-1") {
                        allUpdates.updates.push({
                            "id": edge_csv_data[j][0],
                            "title": null
                        });
                    } else {
                        allUpdates.updates.push({
                            "id": edge_csv_data[j][0],
                            "title": color
                        });
                    }
                    break;  // break out of inner for loop if found match
                }
            }
        }
        edgeUpdateWithError(edges, allUpdates);
    } else {
        resetEdgeTooltipSelect();
    }
}

function updateThresholdSelect(threshold) {
    //console.log("updateThresholdSelect() called - new threshold: " + threshold);
    updateEdgeColorOpacitySelect(edgeColorCSVIndex, edgeOpacityCSVIndex);
}

function updateSizeScale() {
    //console.log("updateSizeScale() called - new : " + sizeScale);
    updateNodeSizeSelect(nodeSizeCSVIndex);
}

function convertHex(hex,opacity) {
    var hex = hex.replace('#','');
    var r = parseInt(hex.substring(0,2), 16);
    var g = parseInt(hex.substring(2,4), 16);
    var b = parseInt(hex.substring(4,6), 16);

    return 'rgba('+r+','+g+','+b+','+opacity/100+')';
}

function rgb2hex(rgb){
    rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
    return (rgb && rgb.length === 4) ? "#" +
        ("0" + parseInt(rgb[1],10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[2],10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[3],10).toString(16)).slice(-2) : '';
}

// this function resets the node color, size, etc according to type
// http://stackoverflow.com/questions/13323168/variable-not-getting-replaced-with-a-value-on-json-generation-in-javascript
// this handles reset for all but color and opacity
function resetVisNodes(resetType) {
    allUpdates = { updates: [] };
    var nodeList = getNodes();
    //console.log("resetType is: " + resetType);
    if(resetType == "size") {
        for(var k = 0; k < nodeList.length; k++) {
            //allUpdates.updates.push({
            var obj = {};
            // obj[resetType] = "10";
            obj[resetType] = min_vis_size;
            // default at http://visjs.org/docs/network/manipulation.html
            obj["id"] = nodeList[k];
            allUpdates.updates.push(obj);
        }
    } else if(resetType == "shape") {
        for(var k = 0; k < nodeList.length; k++) {
            //allUpdates.updates.push({
            var obj = {};
            obj[resetType] = "dot";
            // default at http://visjs.org/docs/network/manipulation.html
            obj["id"] = nodeList[k];
            allUpdates.updates.push(obj);
        }
    } else {
        for(var k = 0; k < nodeList.length; k++) {
            //allUpdates.updates.push({
            var obj = {};
            obj[resetType] = "";
            obj["id"] = nodeList[k];
            allUpdates.updates.push(obj);
        }
    }
    //console.log("about to reset nodes: " + resetType);
    // nodes.update(allUpdates.updates);
    nodeUpdateWithError(nodes, allUpdates);
}

function resetVisEdges(resetType) {
    allUpdates = { updates: [] };
    var edgeList = getEdges();
    console.log("resetType is: " + resetType);
    if(resetType == "width") {
        for(var k = 0; k < edgeList.length; k++) {
            //allUpdates.updates.push({
            var obj = {};
            obj[resetType] = "1";
            obj["id"] = edgeList[k];
            allUpdates.updates.push(obj);
        }
    } else if(resetType == "dashes") {
        for(var k = 0; k < edgeList.length; k++) {
            //allUpdates.updates.push({
            var obj = {};
            obj[resetType] = false;
            obj["id"] = edgeList[k];
            allUpdates.updates.push(obj);
        }
    } else {
        for(var k = 0; k < edgeList.length; k++) {
            //allUpdates.updates.push({
            var obj = {};
            obj[resetType] = "";
            obj["id"] = edgeList[k];
            allUpdates.updates.push(obj);
        }
    }
    console.log("about to reset edges: " + resetType);
    edges.update(allUpdates.updates);
}

// get a list of all nodes in the network
// https://github.com/almende/vis/issues/977
function getNodes() {
    var allNodes = nodes.get();
    var nodeList = [];
    for(var i = 0; i < allNodes.length; i++) {
        nodeList.push(allNodes[i].id);
    }
    return nodeList;
}

// get a list of all edges in the network
function getEdges() {
    var allEdges = edges.get();
    var edgeList = [];
    for(var i = 0; i < allEdges.length; i++) {
        edgeList.push(allEdges[i].id);
    }
    return edgeList;
}

function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}

// the list of colors that are automatically assigned (in this order) to objects for which color annotation is select.  
// if a different color order (or mixing) is desired, then change order in this list - and in the colorNames array below in sync.
// if you want more colors than there (and hence more categories to be annotated), then add the colors here - and in the colorNames array below.
var colors = ['rgba(240,163,255,1)', 'rgba(0,117,220,1)', 'rgba(153,63,0,1)', 'rgba(76,0,92,1)', 'rgba(25,25,25,1)', 'rgba(0,92,49,1)', 'rgba(43,206,72,1)', 'rgba(255,204,153,1)', 'rgba(128,128,128,1)', 'rgba(148,255,181,1)', 'rgba(143,124,0,1)', 'rgba(157,204,0,1)', 'rgba(194,0,136,1)', 'rgba(0,51,128,1)', 'rgba(255,164,5,1)', 'rgba(255,168,187,1)', 'rgba(66,102,0,1)', 'rgba(255,0,16,1)', 'rgba(94,241,242,1)', 'rgba(0,153,143,1)', 'rgba(224,255,102,1)', 'rgba(116,10,255,1)', 'rgba(153,0,0,1)', 'rgba(255,255,128,1)', 'rgba(255,255,0,1)', 'rgba(255,80,5,1)'];
// Note the entries in colorNames are coordinated with entries in colors, so coordinate order changes.
// Color names from http://gauth.fr/2011/09/get-a-color-name-from-any-rgb-combination/
// The color names here are used in network.html in the tooltip so colorblind ppl can read color names.
var colorNames =  ['rich brilliant lavender', 'true blue', 'brown (traditional)', 'indigo (web)', 'dark jungle green', 'sacramento state green', 'lime green', 'peach-orange', 'gray', 'mint green', 'heart gold', 'eton blue', 'medium violet-red', 'dark cerulean', 'orange (web color)', 'carnation pink', 'napier green', 'red', 'electric blue', 'persian green', 'icterine', 'electric indigo', 'ou crimson red', 'pastel yellow', 'electric yellow', 'international orange'];  
// These are the colors of the fonts required to provide contrast within 
// a display.  Presently this isn't used - as only black node has text 
// changed to white later on may want to recolor text of other colors as well.
var fontColors = ['rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(255,255,255,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)', 'rgba(25,25,25,1)'];

// http://www.w3schools.com/charsets/ref_utf_symbols.asp
var shapes = ['&#9671;','&#9675;','&#9734;','&#9651;','&#9661;','&#9633;'];
// not shapeNames is coordinated with shapes
var shapeNames = ['diamond','dot','star','triangle','triangleDown','square'];

// array containig elements that specify the dash lines.  Elements are:
// [gap_length, dash_length, gap_length, dash_length, ...]

var dashSpecs = [ [5,5], [5, 10], [10, 5], [5, 1], [1, 5], [0.9], [15, 10, 5], [15, 10, 5, 10], [15, 10, 5, 10, 15], [5, 5, 1, 5] ];

// dashes
var dashes = [];
// https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray
// '<svg width="100" height="20" viewPort="0 0 100 20" version="1.1" xmlns="http://www.w3.org/2000/svg"> <line stroke-dasharray="5, 5, 3, 3" x1="10" y1="10" x2="90" y2="10" /> <style><![CDATA[ line{ stroke: black; stroke-width: 2; } ]]></style> </svg>'
// the input to visjs is identical to the svg gui element
for( var i=0; i<dashSpecs.length; i++) {
    dashes.push(
        '<svg width="100" height="20" viewPort="0 0 100 20" version="1.1" xmlns="http://www.w3.org/2000/svg"> <line stroke-dasharray="' + dashSpecs[i].toString() +  '" x1="10" y1="10" x2="90" y2="10" /> <style><![CDATA[ line{ stroke: black; stroke-width: 2; } ]]></style> </svg>'
    );
} 

function handleHisto(cb) {
    console.log("interactive histogram has new state: " + cb.checked );
    if(cb.checked) {
        createHisto();
    } else {
        closeHisto();
    }
}
    
var histoWindowOptions = {
    show: true,
    "new-instance": false,
    "toolbar": false, // this makes a debug window available if set to true
    "width": 800,
    "height": 600,
    "icon": "icons/image16.png"
}
    
function createHisto() {
    histo_win = gui.Window.open("histo.html", histoWindowOptions); 
    
    histo_win.on ('loaded', function(){
        // the native onload event has just occurred
        histo_win.window.haveParent(network_win, myNodes, myEdges);
        console.log("histo finished loading");
        // add the select events to the histogram
        histo_win.window.className = "histo";
        EventBus.addEventListener('select', histo_win.window.handle_network_select, histo_win.window);
        EventBus.addEventListener('deselect', histo_win.window.handle_network_deselect, histo_win.window);
    });
    
    histo_win.on('close', closeHisto);
}
    
function closeHisto() {
    histo_win.hide();
    // remove the select events
    EventBus.removeEventListener('select', histo_win.window.handle_network_select, histo_win.window);
    EventBus.removeEventListener('deselect', histo_win.window.handle_network_deselect, histo_win.window);
    console.log('histo window is closing');
    histo_win.close(true);
    $('input:checkbox[name=histocb]').attr('checked',false);
    histo_win = 0;
}
    
function handleMap(cb) {
    console.log("map display has new state: " + cb.checked);
    if(cb.checked) {
        createMap();
    } else {
        closeMap();
    }
}
    
var mapWindowOptions = {
    show: true,
    "new-instance": false,
    "toolbar": true, // this makes a debug window available if set to true
    "width": 700,
    "height": 800,
    "icon": "icons/image16.png"
}
    
function createMap() {
    map_win = gui.Window.open("map.html", mapWindowOptions); 
    
    map_win.on ('loaded', function(){
        // the native onload event has just occurred
        if(!map_win.window.haveParent(network_win,network_node_csv_data,node_csv_data_header)) {
            // in this case there was no connect to a google maps server.  Indicate error and disable map cb
            BootstrapDialog.show({ 
                title: 'Map Connection Error', 
                message: 'The map display is unable to access Google Maps servers.  \n\nPlease check connectivity.\n\nClosing map display: ', 
                draggable: true, 
                type: BootstrapDialog.TYPE_DANGER,
                buttons: [{
                    label: 'Close Map Display',
                    action: function(dialogItself){
                        closeMap();
                        // document.getElementsByName("mapcb")[0].disabled = true;
                        dialogItself.close();
                    }
                }]
            });
        } else {
            // handle case where google map connection worked - hook up events
            console.log("map finished loading");
            // add the select events to the map
            map_win.window.className = "map";
            EventBus.addEventListener('select', map_win.window.handle_id_select, map_win.window);
            EventBus.addEventListener('deselect', map_win.window.handle_id_deselect, map_win.window);
            // now put all the currently selected nodes on the EventBus (to get the initial data right). 
            var currentlySelectedNodes = network.getSelectedNodes();
            // console.log("initializing map_win with already selected nodes: " + currentlySelectedNodes);
            this.className = "network";  // indicate source of event
            EventBus.dispatch('select', this, currentlySelectedNodes); // tell map and datagrid currently selected nodes
        }
    });
    
    map_win.on('close', closeMap);
}
    
function closeMap() {
    map_win.hide();
    // remove the select events
    EventBus.removeEventListener('select', map_win.window.handle_id_select, map_win.window);
    EventBus.removeEventListener('deselect', map_win.window.handle_id_deselect, map_win.window);
    console.log('map window is closing');
    map_win.close(true);
    $('input:checkbox[name=mapcb]').attr('checked',false);
    map_win = 0;
}
    
function handleDatagrid(cb) {
    console.log("datagrid display has new state: " + cb.checked);
    if(cb.checked) {
        createDatagrid();
    } else {
        closeDatagrid();
    }
}
    
var datagridWindowOptions = {
    show: true,
    "new-instance": false,
    "toolbar": false, // this makes a debug window available if set to true
    "width": 970,
    "height": 760,
    "icon": "icons/image16.png"
}
    
function createDatagrid() {
    datagrid_win = gui.Window.open("datagrid.html", datagridWindowOptions); 
    
    datagrid_win.on ('loaded', function(){
        // the native onload event has just occurred
        datagrid_win.window.haveParent(network_win, network_node_csv_data, datatable_data_header, node_csv_ids_to_edge_csv_ids);
        console.log("datagrid finished loading");
        // add the select events to the datagrid
        datagrid_win.window.className = "datagrid";
        EventBus.addEventListener('select', datagrid_win.window.handle_network_select, datagrid_win.window);
        EventBus.addEventListener('deselect', datagrid_win.window.handle_network_deselect, datagrid_win.window);
        // now put all the currently selected nodes on the EventBus (to get the initial data right). 
        var currentlySelectedNodes = network.getSelectedNodes();
        // console.log("initializing datagrid_win with already selected nodes: " + currentlySelectedNodes);
        this.className = "network";  // indicate source of event
        EventBus.dispatch('select', this, currentlySelectedNodes); // tell map and datgrid currently selected nodes
    });
    
    datagrid_win.on('close', closeDatagrid);
}
    
function closeDatagrid() {
    datagrid_win.hide();
    // remove the select events
    EventBus.removeEventListener('select', datagrid_win.window.handle_network_select, datagrid_win.window);
    EventBus.removeEventListener('deselect', datagrid_win.window.handle_network_deselect, datagrid_win.window);
    console.log('datagrid window is closing');
    datagrid_win.close(true);
    $('input:checkbox[name=datagridcb]').attr('checked',false);
    datagrid_win = 0;
}
    
    
function closeAllWindows() {
    if(map_win != 0)
        closeMap();
    if(histo_win != 0)
        closeHisto();
    if(datagrid_win!= 0)
        closeDatagrid();
    // and finally close the network window
    network_win.hide();
    console.log('network window is closing');
    network_win.close(true);
}

function createAndPopulateNetwork(parMyNodes, parMyEdges) {
    myNodes = parMyNodes;
    myEdges = parMyEdges;

    // create the vis dataset
    nodes = new vis.DataSet(myNodes);
    edges = new vis.DataSet(myEdges);
    network_data = { nodes: nodes, edges: edges }
    console.log("after network_data creation");

    // create a network container
    //var container = document.getElementById('mynetwork');
    var container = $('#mynetwork');
    //var options = {};
    // try to fix jiggling in some input files with some options
    // http://visjs.org/docs/network/physics.html#
    var options = {
        autoResize: true,
        interaction: {
            keyboard: true,
            selectable: true,
            selectConnectedEdges: true,
            dragView: true,
            multiselect: true
        },
        height: '100%',
        width: '100%',
        physics: {
            forceAtlas2Based: {
                gravitationalConstant: -200,
                centralGravity: 0.04,
                springLength: 100,
                damping: 0.21
            },
            maxVelocity: 16,
            minVelocity: 0.55,
            solver: 'forceAtlas2Based',
            timestep: 0.89
        }
    };
    console.log("about to create network");
    // make a test network from test data global test_network_data
    // var network = new vis.Network(container, test_network_data, options);
    // display data from hivtrace output
    //var network = new vis.Network(container, network_data, options);
    network = new vis.Network(container[0], network_data, options);
    canvas = network.canvas.frame.canvas;
    ctx = canvas.getContext('2d');
    console.log("network has been created");

    network.on("stabilizationProgress", function(params) {
        // console.log("inside stabilizationProgress");
        var maxWidth = 496;
        var minWidth = 20;
        var widthFactor = params.iterations/params.total;
        var width = Math.max(minWidth,maxWidth * widthFactor);
    
        document.getElementById('lbbar').style.width = width + 'px';
        document.getElementById('lbtext').innerHTML = Math.round(widthFactor*100) + '%';
    });
    network.once("stabilizationIterationsDone", function() {
        console.log("inside stabilizationIterationsDone");
        document.getElementById('lbtext').innerHTML = '100%';
        document.getElementById('lbbar').style.width = '496px';
        document.getElementById('loadingBar').style.opacity = 0;
        // really clean the dom element
        setTimeout(function () {document.getElementById('loadingBar').style.display = 'none';}, 500);
    });
    // network node select events
    // https://datatables.net/reference/type/row-selector
    // https://datatables.net/reference/api/row().scrollTo()
    network.on("selectNode", function (params) {
        var selNodes = params.nodes;
        // console.log("dispatching events from selectNode: " + selNodes);
        this.className = "network"; // indicate source of event
        EventBus.dispatch('select', this, selNodes); // tell map and datagrid and histo
    });
    
    // handle a network deselectNode event
    network.on("deselectNode", function (params) {
    
        // console.log('selected nodes in deselect event: ' + params.nodes + ' previously selected: ' + params.previousSelection.nodes);
        // http://stackoverflow.com/questions/1723168/what-is-the-fastest-or-most-elegant-way-to-compute-a-set-difference-using-javasc
        var deselNodes = params.previousSelection.nodes.filter(function(x) { return params.nodes.indexOf(x) < 0 });
        // console.log("dispatching events from deselectNode: " + deselNodes);
        this.className = "network"; // indicate source of event
        EventBus.dispatch('deselect', this, deselNodes); // tell map and datagrid and histo
    });
    
    // add the (de)select bus events to the network display 
    EventBus.addEventListener('select', selectNodes, this);
    EventBus.addEventListener('deselect', deselectNodes, this);

    var drag = false;
    // start code mouse swipe select
    canvas.addEventListener('mousemove', function(evt) {
        var mousePos = getMousePos(canvas, evt);
        if (drag) { 
            restoreDrawingSurface();
            rect.w = mousePos.x - rect.startX;
            rect.h = mousePos.y - rect.startY ;
            ctx.setLineDash([5]);
            ctx.strokeStyle = "rgb(0, 102, 0)";
            ctx.strokeRect(rect.startX, rect.startY, rect.w, rect.h);
            ctx.setLineDash([]);
            ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
            ctx.fillRect(rect.startX, rect.startY, rect.w, rect.h);
        }
    
        //}, false);
    }, true);
    
    
    canvas.addEventListener('mousedown', function(evt) {
        var mousePos = getMousePos(canvas, evt);
        //console.log("shift key in mousedown is: " + getKeys(evt));
        if (evt.button == 2) { 
            // https://github.com/dragonzone/JsSamplerApp/blob/master/src/main/webapp/js/link-analysis-listeners.js
            network.setOptions({
                physics: {
                    enabled: false
                }
            });
    
            selectedNodes = evt.ctrlKey ? network.getSelectedNodes() : null;
            saveDrawingSurface();
            rect.startX = mousePos.x;
            rect.startY = mousePos.y;
            drag = true;
            container[0].style.cursor = "crosshair";
        } 
    }, false);
    
    container.on('mouseup', function(e) {
    //console.log("shift key in mouseup is: " + getKeys(e));
        if (e.button == 2) { 
            restoreDrawingSurface();
            drag = false;
    
            container[0].style.cursor = "default";
            selectNodesFromHighlight(e.ctrlKey);
    
            network.setOptions({
                physics: {
                    enabled: true
                }
            });
        }
    }); 
    
    document.body.oncontextmenu = function() {return false;};
    // end code mouse swipe select
}
    
    
// this code for the mouse swipe select
// http://jsfiddle.net/kbj54bas/16/
function saveDrawingSurface() {
    drawingSurfaceImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
}
    
function restoreDrawingSurface() {
    ctx.putImageData(drawingSurfaceImageData, 0, 0);
}
    
function selectNodesFromHighlight(ctrlPressed) {
    var fromX, toX, fromY, toY;
    var nodesIdInDrawing = [];
    var xRange = getStartToEnd(rect.startX, rect.w);
    var yRange = getStartToEnd(rect.startY, rect.h);
    
    var allNodes = nodes.get();
    for (var i = 0; i < allNodes.length; i++) {
        var curNode = allNodes[i];
        var nodePosition = network.getPositions([curNode.id]);
        var nodeXY = network.canvasToDOM({x: nodePosition[curNode.id].x, y: nodePosition[curNode.id].y});
        if(xRange.start <= nodeXY.x && nodeXY.x <= xRange.end && yRange.start <= nodeXY.y && nodeXY.y <= yRange.end) {
            nodesIdInDrawing.push(curNode.id);
        }
    }
    
    var currently_selected_nodes = network.getSelectedNodes()
    //console.log("ctrlPressed is: " + ctrlPressed);
    if(ctrlPressed) {
        // add these to the already selectedNodes
        var allSelectedNodes = union_arrays(currently_selected_nodes,nodesIdInDrawing);
        network.selectNodes(allSelectedNodes);
        // put the select out on the eventbus
        // console.log("dispatching multipe node selects from highlight: " + allSelectedNodes);
        network.className = "network";  // indicate source of event
        EventBus.dispatch('select', network, allSelectedNodes); // tell map and datagrid
    } else { // else remove previously selected nodes
        // put the deselect out on the eventbus
        // console.log("dispatching multiple node deselects from highlight: " + currently_selected_nodes);
        network.className = "network";
        EventBus.dispatch('deselect', network, currently_selected_nodes);
        network.unselectAll();
        network.selectNodes(nodesIdInDrawing);
        // put the newly selected nodes out on the eventbus
        // console.log("dispatching multipe node selects from highlight: " + allSelectedNodes);
        network.className = "network";  // indicate source of event
        EventBus.dispatch('select', network, nodesIdInDrawing); // tell map and datagrid
    }
}
    
// http://stackoverflow.com/questions/12772943/getting-cursor-position-in-a-canvas-without-jquery
function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect(), root = document.documentElement;
    
    // return relative mouse position
    var mouseX = evt.clientX - rect.left - root.scrollLeft;
    var mouseY = evt.clientY - rect.top - root.scrollTop;
    return {
        x: mouseX,
        y: mouseY
    };
}
    
function getStartToEnd(start, theLen) {
    return theLen > 0 ? {start: start, end: start + theLen} : {start: start + theLen, end: start};
}
// end code mouse swipe select

function clone(obj) {
    if(obj === null || typeof(obj) !== 'object' || 'isActiveClone' in obj)
        return obj;
    var temp = new obj.constructor(); // changed
    for(var key in obj) {
        if(Object.prototype.hasOwnProperty.call(obj, key)) {
            obj['isActiveClone'] = null;
            temp[key] = clone(obj[key]);
            delete obj['isActiveClone'];
        }
    }    
    return temp;
}

var theParent;
function haveParent(
            theParent
//,
//            param_node_csv_file,
//            param_edge_csv_file,
//            param_max_node_csv_data,
//            param_max_edge_csv_data,
//            param_min_node_csv_data,
//            param_min_edge_csv_data,
//            param_network_node_csv_data,
//            param_edge_csv_data,
//            param_node_csv_data_header,
//            param_edge_csv_data_header,
//            param_node_csv_data_type,
//            param_edge_csv_data_type,
//            param_unique_node_csv_data_t,
//            param_unique_edge_csv_data_t,
//            param_lengthsPresent,
//            param_node_csv_ids_to_edge_csv_ids,
//            param_datatable_data_header
	) {
    parent = theParent;
    /* node_csv_file = param_node_csv_file;
    edge_csv_file = param_edge_csv_file;
    max_node_csv_data = param_max_node_csv_data;
    max_edge_csv_data = param_max_edge_csv_data;
    min_node_csv_data = param_min_node_csv_data;
    min_edge_csv_data = param_min_edge_csv_data;
    network_node_csv_data = param_network_node_csv_data;
    edge_csv_data = param_edge_csv_data;
    node_csv_data_header = param_node_csv_data_header;
    edge_csv_data_header = param_edge_csv_data_header;
    node_csv_data_type = param_node_csv_data_type;
    edge_csv_data_type = param_edge_csv_data_type;
    unique_node_csv_data_t = param_unique_node_csv_data_t;
    unique_edge_csv_data_t = param_unique_edge_csv_data_t;
    lengthsPresent = param_lengthsPresent;
    node_csv_ids_to_edge_csv_ids = param_node_csv_ids_to_edge_csv_ids;
    datatable_data_header = param_datatable_data_header; */
    // maps get deep copied with new Map, arrays get deep copied with clone
    node_csv_file = parent.window.node_csv_file;
    edge_csv_file = parent.window.edge_csv_file;
    max_node_csv_data = new Map(parent.window.max_node_csv_data);
    max_edge_csv_data = new Map(parent.window.max_edge_csv_data);
    min_node_csv_data = new Map(parent.window.min_node_csv_data);
    min_edge_csv_data = new Map(parent.window.min_edge_csv_data);
    network_node_csv_data = clone(parent.window.network_node_csv_data);
    edge_csv_data = clone(parent.window.edge_csv_data);
    node_csv_data_header = clone(parent.window.node_csv_data_header);
    edge_csv_data_header = clone(parent.window.edge_csv_data_header);
    node_csv_data_type = clone(parent.window.node_csv_data_type);
    edge_csv_data_type = clone(parent.window.edge_csv_data_type);
    unique_node_csv_data_t = clone(parent.window.unique_node_csv_data_t);
    unique_edge_csv_data_t = clone(parent.window.unique_edge_csv_data_t);
    lengthsPresent = parent.window.lengthsPresent;
    node_csv_ids_to_edge_csv_ids = new Map(parent.window.node_csv_ids_to_edge_csv_ids);
    datatable_data_header = clone(parent.window.datatable_data_header);
    
    // disable datagrid checkbox if no node csv file
    if(isBlank(node_csv_file))
        document.getElementsByName("datagridcb")[0].disabled = true;

    // see if there are any lat lon columns in node csv, if no, then disable map
    var lat_index = -1;
    var lng_index = -1;
    if(node_csv_data_header != undefined) {
        var lat_index = node_csv_data_header.indexOf("lat");
        var lng_index = node_csv_data_header.indexOf("lon");
    }
    // check to make sure we have both latitude and longitude
    if( (lat_index >= -1) && (lng_index >= -1) ) 
        document.getElementsByName("mapcb")[0].disabled = false;

    // if no lengths present then disable histogram cb
    if(!lengthsPresent)
        document.getElementsByName("histocb")[0].disabled = true;

    fillDropdownMenus();

    // close all child windows upon app exit
    network_win = gui.Window.get();
    network_win.on('close', closeAllWindows);
}
    
// http://visjs.org/examples/network/other/animationShowcase.html
// Camera animate a zoom to one selected node and then back to original view in order to make it easy 
// for the user to see which node has been selected.
// If there are already nodes selected, then zoom out to a view which includes the already selected 
// nodes plus the newly selected node.
function doTheShow(nodeIds, allNodeIds) {
    var duration = 1200;
    var currentCenter = network.getViewPosition();
    var currentScale = network.getScale();
    focusNodes(nodeIds,currentScale,duration);
     setTimeout(function() { 
        fitAnimated(allNodeIds,currentCenter, currentScale, duration);
    }, 1.5*duration);
}
    
// Focuses viewport on node that has just been selected at a scale 1 greater 
// than current scale (zoom level).
function focusNodes(nodeIds, scale, duration) {
    if(nodeIds.length == 1) {
        var focusScale = scale + 1.0;
        //var focusScale = scale;
        var offsetx = 0.0;
        var offsety = 0.0;
        // Animation easing function, available are:
        // linear, easeInQuad, easeOutQuad, easeInOutQuad,
        // easeInCubic, easeOutCubic, easeInOutCubic,
        // easeInQuart, easeOutQuart, easeInOutQuart,
        // easeInQuint, easeOutQuint, easeInOutQuint
        var easingFunction = "easeInOutQuad";
        var options = {
            // position: {x:positionx,y:positiony}, // this is not relevant when focusing on nodes
            scale: focusScale,
            offset: {x:offsetx,y:offsety},
            animation: {
                duration: duration,
                easingFunction: easingFunction
            }
        };
        //console.log('Focusing on nodes: ' + nodeIds);
        network.focus(nodeIds[0], options);
    } else {
        var options = {
            nodes: nodeIds,
            animation: {
                duration: duration,
                easingFunction: easingFunction
            }
        };
        // console.log('Zooming best fit to all nodes: ' + nodeIds);
        network.fit(options);
    }
}
    
function fitAnimated(nodeIds, prevCenter, prevScale, duration) {
    // zoom back either to same viewport, or to the best view of all the previously selected nodes
    // plus the newly selected node if more than one node is selected.
    var easingFunction = "easeInOutQuad";
    var offsetx = 0.0;
    var offsety = 0.0;
    var allNodeIds = network.getSelectedNodes();
    if(nodeIds.length > 1) { // center all the selected nodes
        var options = {
            nodes: nodeIds,
            animation: {
                duration: duration,
                easingFunction: easingFunction
            }
        };
        // console.log('Zooming best fit to all nodes: ' + nodeIds);
        network.fit(options);
    } else { // only one newly selected node, zoom back out to a previous view before camera zoom
        var options = {
            position: prevCenter,
            //nodes: nodeIds,
            scale: prevScale,
            animation: {
                duration: duration,
                easingFunction: easingFunction
            }
        }
        // console.log('Returning to previous view animation.');
        network.moveTo(options);
        //network.fit(options);
    }
}
    
// This function selects all nodes in selectedNodes in the network display.
// The array selectedNodes contains a list of nodes which have been recently selected in map or datagrid.
// Note that this function will only add to the previously selected node list - it doesn't deselect any.
// This function is called from the event bus so responds to node selections in map or datagrid.
function selectNodes(event,selectedNodes) {
    if(event.target.className !== "network") {
        //console.log("about to do a network.selectNodes off selectNodes called from EventBus with nodeNames: " + selectedNodes);
        /* note this should not be necessary since the network display is a superset of map and spreadsheet
        // now figure out which if these are in the network display and select the ones that are
        var selectedNetworkNodes = [];
        if(all_hivtrace_nodes !== undefined) {
            for( var idx = 0; idx < selectedNodes.length; idx++ ) {
                if(all_hivtrace_nodes.indexOf(selectedNodes[idx]) != -1) {
                    selectedNetworkNodes.push(selectedNodes[idx]);
                }
            }
        } else if(all_edge_csv_nodes !== undefined) {
            for( var idx = 0; idx < selectedNodes.length; idx++ ) {
                if(all_edge_csv_nodes.indexOf(selectedNodes[idx]) != -1) {
                    selectedNetworkNodes.push(selectedNodes[idx]);
                }
            }
        } */
        // Because selectNodes deselects all previously selected nodes, we must preserve them
        var prevSelectedNodes = network.getSelectedNodes();
        // now add the newly selected ones to them
        var allNodes = union_arrays(prevSelectedNodes,selectedNodes);
        // here we call the network select nodes function
        network.selectNodes(allNodes, true); // note that this method does not propagate events!
        // this zooms in and out around a the selected nodes.
        doTheShow(selectedNodes, allNodes);
    }
}
    
// this function deselects a node with name nodeName in the network display
// this function is called from the event bus so responds to node deselections in map or datagrid
function deselectNodes(event,nodeNames) {
    //console.log("in network deselectNodes event.target.className: " + event.target.className);
    if(event.target.className !== "network") {
        //console.log("about to do a network.selectNodes off deselectNodes called from EventBus with nodeNames: " + nodeNames);
        // get a list of currently selected network nodes (remember user could have already selected 
        // nodes with a mouse on network display)
        var currentlySelectedNetworkNodes = network.getSelectedNodes();
            
        // There is no network.deselectNodes(array) for single or multiple nodes, 
        // so deselect them all and then re-select all but the one deselected.
    
        // unselect all network nodes (clear the plate - this because there is no network.deselectNodes(...) 
        network.unselectAll(); // rows that were selected will get re-added - note this does not throw events
            
        // if any of the network node names match the deselected nodeName one, dont reselect it.
        var reSelectNetworkNodes = [];
        for( var idx = 0; idx < nodeNames.length; idx++ ) {
            if( currentlySelectedNetworkNodes.indexOf(nodeNames[idx]) != -1 ) {
                reSelectNetworkNodes.push(currentlySelectedNetworkNodes[idx]);
            }
        }
        // console.log("after deselect in network.deselectNodes with nodes to reselect: " + reSelectNetworkNodes);
        network.selectNodes(reSelectNetworkNodes, true); // note that this method does not propagate events!
    }
}


function fillDropdownMenus() {

    // vars for the dropdowns
    var index, jndex, kndex, opt, opt2, opt3;

    // if the input is via node_csv
    if(typeof node_csv_data_header !== 'undefined') { // no node data cause no node csv provided
        // edge-object dropdown initialization 
    
        // node label
        console.log("creating node label html");
        var labelDropdown = document.getElementById("cnLaSubMenu");
        var docfrag = document.createDocumentFragment();
        //  <a href="#" class="list-group-item" data-parent="#cnLaSubMenu">Subitem 1 a</a>
        for(index = 0; index < node_csv_data_header.length; index++) {
            opt = node_csv_data_header[index];
            var link = document.createElement("a");
            var text = document.createTextNode(opt);
            link.appendChild(text);
            link.href = "#";
            link.classList.add("list-group-item");
            link.setAttribute("csv_index",index);
            link.setAttribute("data-parent","#cnLaSubMenu");
            docfrag.appendChild(link);
        }
        // create the 'reset' selection
        var link = document.createElement("a");
        var text = document.createTextNode(" ");
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-1");
        link.setAttribute("data-parent","#cnLaSubMenu");
        docfrag.appendChild(link);
        labelDropdown.appendChild(docfrag);
        // hook up updates and box to display selection
        $('#labelbox').attr("value",nodeLabelSelect);
        $('#cnLaSubMenu a').on('click', function(){
            // $('#labelbox').val($(this).text());
            if(nodeLabelSelect != $(this).text()) {
                nodeLabelSelect = $(this).text();
                //$( this ).parent().prev().text("Label (" + nodeLabelSelect + ")");
                $('#labelbox').attr("value",nodeLabelSelect);
                updateNodeLabelSelect($(this).attr("csv_index"));
            }
        });
    
        // node size
        console.log("creating node size html");
        var sizeDropdown = document.getElementById("cnSiSubMenu");
        var docfrag = document.createDocumentFragment();
        // now add list entries that depend on csv headers
        for(index = 0; index < node_csv_data_header.length; index++) {
            if( node_csv_data_type[index] == "num" ) {
                opt = node_csv_data_header[index];
                var link = document.createElement("a");
                var text = document.createTextNode(opt);
                link.appendChild(text);
                link.href = "#";
                link.classList.add("list-group-item");
                link.setAttribute("csv_index",index);
                link.setAttribute("data-parent","#cnSiSubMenu");
                docfrag.appendChild(link);
            }
        }
        // create the node size 'reset' selection
        var link = document.createElement("a");
        var text = document.createTextNode(" ");
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-1");
        link.setAttribute("data-parent","#cnSiSubMenu");
        docfrag.appendChild(link);
        sizeDropdown.appendChild(docfrag);
        // hook up updates and box to display selection
        $('#sizebox').val(nodeSizeSelect);
        $('#cnSiSubMenu a').on('click', function(){
            $('#sizebox').val($(this).text());
            if(nodeSizeSelect != $(this).text()) {
                nodeSizeSelect = $(this).text();
                //$( this ).parent().prev().text("Size (" + nodeSizeSelect + ")");
                $('#sizebox').val(nodeSizeSelect);
                // for some reason (bug in visjs) a size setting without a shape setting does nothing
                if(nodeShapeCSVIndex == -1) {
                    resetVisNodes("shape");
                }
                updateNodeSizeSelect($(this).attr("csv_index"));
            }
        });
    
        // node color
        console.log("creating node color html");
        // for background on 'not-dynamically created' html that formed the 
        // basis of the dynamically created elements below 
        // see ../notes/index_navmenu7.html.  and the accordian bootply...
        var colorDropdown = document.getElementById("cnCoSubMenu");
        var docfrag = document.createDocumentFragment();
        // now add list entries that depend on csv headers
        // loop over all possible variables (csv column header elements)
        for (index = 0; index < node_csv_data_header.length; index++) {
            // skip csv column as a color selection parameter if it has too 
            // many data values (only a certain number of colors are easily seen)
            if(unique_node_csv_data_t[index].length <= colors.length) {
                // create the menu items that are the column headers
                // <a href="#SubSubMenu1" class="list-group-item strong" data-toggle="collapse" data-parent="#cnCoSubMenu"><i class="glyphicon glyphicon-user"></i>Column Header 1<i class="fa fa-caret-down"></i></a>
                opt = node_csv_data_header[index];
                var link = document.createElement("a");
                // var text = document.createTextNode("<i class='glyphicon glyphicon-user'></i>" + opt + "<i class='fa fa-caret-down'></i>");  // contains "Column Header 1" (with the html enamoration before and after) for instance
                var text = document.createTextNode(opt);  // contains "Column Header 1" (with the html enamoration before and after) for instance
                link.appendChild(text);
                link.href = "#" + "cnCoSubMenuIndex" + index;  // refers to id on div immediately below
                link.classList.add("list-group-item");
                link.classList.add("strong");
                link.setAttribute("csv_index",index);  // add this so we know what to change upon selection or update
                link.setAttribute("data-parent","#cnCoSubMenu"); // this refers to the parent div above
                link.setAttribute("data-toggle","collapse");
                docfrag.appendChild(link);
                // now add the unique items for each column (and allow a color select for each one)
                // first step is to add a div which controls the dropdown
                // <div class="collapse list-group-submenu list-group-submenu-1" id="cnCoSubMenuIndex1">
                var divchoice = document.createElement("div");
                divchoice.classList.add("collapse");
                divchoice.classList.add("list-group-submenu");
                divchoice.classList.add("list-group-submenu-1");
                divchoice.setAttribute("id", "cnCoSubMenuIndex" + index );
                // loop over all the unique entries in each column
                for (jndex = 0; jndex < unique_node_csv_data_t[index].length; jndex++) {
                    // now create an input-group div to bind the text entry and the dropdown together
                    // <div class="input-group" data-parent="#cnCoSubMenuIndex1">
                    var divchoice1 = document.createElement("div");
                    divchoice1.classList.add("input-group");
                    divchoice1.setAttribute("data-parent","#cnCoSubMenuIndex" + index);
                    // now create the input-group-btn for the dropdown
                    // <div class="input-group-btn">
                    var divchoice2 = document.createElement("div");
                    divchoice2.classList.add("input-group-btn");
                    // now create the select html tag
                    // <select id="colorselector1" class="list-group-item">
                    var select = document.createElement("select");
                    select.setAttribute("id","colorselector" + jndex);
                    select.classList.add("list-group-item");
                    // now add all the colors as options under the select html tag
                    for(kndex = 0; kndex < colors.length; kndex++) {
                        // <option value="107" data-color="#A0522D">sienna</option>
                        var option = document.createElement("option");
                        // prepare to pass the csv_index and the unique_index to the onclick function
                        var text2 = document.createTextNode(colorNames[kndex]);
                        option.appendChild(text2);
                        // set attribute to json string containing identifying parameters for selector - tried this it doesn't work
                        // var passJsoc = '{"csv_index":"' + index + '", "unique_index":"' + jndex + '"}';
                        // put an index into the color array in the value attribute
                        option.setAttribute("value",kndex);  // the plugin requies a unique value
                        option.setAttribute("data-color",colors[kndex]);
                        option.setAttribute("color-control-context","context_index_jndex-"+index+"-"+jndex);
                        // <option value="48" data-color="#CD5C5C" selected="selected">indianred</option>
                        if(kndex == jndex) {
                            option.setAttribute("selected","selected");
                        }
                        select.appendChild(option);
                    }
                    divchoice2.appendChild(select);
                    // <input type="text" class="form-control" value="this is a test" aria-label="..." style="color: #FF0000" readonly>
                    opt2 = unique_node_csv_data_t[index][jndex];
                    if(opt2 == "") {
                        opt2 = "Null";  // if null then a half height box is presented
                    }
                    var inputEl = document.createElement("input");
                    inputEl.classList.add("form-control");
                    inputEl.setAttribute("value",opt2);
                    inputEl.setAttribute("aria-label","...");
                    inputEl.setAttribute("csv_index",index);  // add this so we know what to change upon selection or update
                    inputEl.setAttribute("unique_index",jndex);  // add this so we know what to change upon selection or update
                    inputEl.setAttribute("style","color:" + colors[jndex]); 
                    inputEl.setAttribute("readonly","true");
                    divchoice1.appendChild(divchoice2);
                    divchoice1.appendChild(inputEl);
                    divchoice.appendChild(divchoice1);
                }
                docfrag.appendChild(divchoice);
            }
        }
        // create the node color 'reset' selection
        var link = document.createElement("a");
        var text = document.createTextNode(" ");
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-1");
        link.setAttribute("data-parent","#cnCoSubMenu");
        docfrag.appendChild(link);
        colorDropdown.appendChild(docfrag);
        // hook up updates and box to display selection
        $('#colorbox').val(nodeColorSelect);
        $('#cnCoSubMenu > a').on('click', function(){
            // console.log("the color box text is: " + $(this).children('a').clone().children().remove().end().text());
            //$('#colorbox').val($(this).text()); // doesn't work gets all child text as well
            // $('#colorbox').val($(this).children('a').clone().children().remove().end().text());
            //console.log("in on click that calls updateNodeColorSelect1");
            if(nodeColorSelect != $(this).text()) {
                nodeColorSelect = $(this).text();
                //$( this ).parent().prev().text("Color (" + nodeColorSelect + ")");
                $('#colorbox').val(nodeColorSelect);
                updateNodeColorSelect1($(this).attr("csv_index"));
            }
        });

        
        // node shape
        console.log("creating node shape html");
        // for 'not-dynamically created' html that formed the basis of the dynamically created elements below
        // see ../notes/index_navmenu7.html.  and the accordian bootply...
        var shapeDropdown = document.getElementById("cnShSubMenu");
        var docfrag = document.createDocumentFragment();
        // now add list entries that depend on csv headers
        // loop over all possible variables (csv column header elements)
        for (index = 0; index < node_csv_data_header.length; index++) {
            // skip csv column as a shape selection parameter if it has too
            // many data values (only a certain number of shapes are available in vis.js)
            if( (node_csv_data_type[index] == "str") && (unique_node_csv_data_t[index].length <= shapes.length) ) {
                // create the menu items that are the shape headers
                // <a href="#SubSubMenu1" class="list-group-item strong" data-toggle="collapse" data-parent="#cnShSubMenu"><i class="glyphicon glyphicon-user"></i>Column Header 1<i class="fa fa-caret-down"></i></a>
                opt = node_csv_data_header[index];
                var link = document.createElement("a");
                // var text = document.createTextNode("<i class='glyphicon glyphicon-user'></i>" + opt + "<i class='fa fa-caret-down'></i>");  // contains "Column Header 1" (with the html enamoration before and after) for instance
                var text = document.createTextNode(opt);  // contains "Column Header 1" (with the html enamoration before and after) for instance
                link.appendChild(text);
                link.href = "#" + "cnShSubMenuIndex" + index;  // refers to id on div immediately below
                link.classList.add("list-group-item");
                link.classList.add("strong");
                link.setAttribute("csv_index",index);  // add this so we know what to change upon selection or update
                link.setAttribute("data-parent","#cnShSubMenu"); // this refers to the parent div above
                link.setAttribute("data-toggle","collapse");
                docfrag.appendChild(link);
                // now add the unique items for each column (and allow a shape select for each one)
                // first step is to add a div which controls the dropdown
                // <div class="collapse list-group-submenu list-group-submenu-1" id="cnShSubMenuIndex1">
                var divchoice = document.createElement("div");
                divchoice.classList.add("collapse");
                divchoice.classList.add("list-group-submenu");
                divchoice.classList.add("list-group-submenu-1");
                divchoice.setAttribute("id", "cnShSubMenuIndex" + index );
                // loop over all the unique entries in each column
                for (jndex = 0; jndex < unique_node_csv_data_t[index].length; jndex++) {
                    // now create an input-group div to bind the text entry and the dropdown together
                    // <div class="input-group" data-parent="#cnShSubMenuIndex1">
                    var divchoice1 = document.createElement("div");
                    divchoice1.classList.add("input-group");
                    divchoice1.setAttribute("data-parent","#cnShSubMenuIndex" + index);
                    // now create the input-group-btn for the dropdown
                    // <div class="input-group-btn">
                    var divchoice2 = document.createElement("div");
                    divchoice2.classList.add("input-group-btn");
                    // now create the button with graphic indicating shape (see ../notes/notes_shape_buttons.txt)
                    // and index_navmeny7e.html
                    // <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">&#9671;  <span class="caret"></span></button>
                    var current_shape = document.createElement("button");
                    var text2insert = shapes[jndex];
                    current_shape.innerHTML = text2insert;
                    current_shape.setAttribute("title",shapeNames[jndex]);
                    current_shape.classList.add("btn");
                    current_shape.classList.add("btn-default");
                    current_shape.classList.add("dropdown-toggle");
                    current_shape.setAttribute("data-toggle","dropdown");
                    current_shape.setAttribute("aria-haspopup","true");
                    current_shape.setAttribute("aria-expanded","false");
                    /// including these (///) makes the onclick action in (
                    /// $('#cnShSubMenu > div > div > div > ul > li > a' ) not work below - so remove for now - makes more similar to color anyway
                    ///var carrot = document.createElement("span"); 
                    ///carrot.classList.add("caret");
                    ///current_shape.appendChild(carrot);
                    // <ul class="dropdown-menu">
                    var shape_select_ul = document.createElement("ul");
                    shape_select_ul.classList.add("dropdown-menu");
                    // now add all the shapes as selections under the shape ul dropdown menu
                    for(kndex = 0; kndex < shapes.length; kndex++) {
                        // <li><a href="#">&#9671;</a></li>
                        var link2 = document.createElement("a");
                        var text2insert2 = shapes[kndex] + " ";
                        link2.innerHTML = text2insert2; // safe cause text comes from internal javascript array
                        link2.setAttribute("href","#");
                        // prepare to pass the csv_index, unique_index, and shape info to the onclick function
                        link2.setAttribute("shape_index",kndex);  // the plugin requies a unique value
                        link2.setAttribute("title",shapeNames[kndex]);
                        var li = document.createElement("li");
                        li.appendChild(link2);
                        shape_select_ul.appendChild(li);
                    }
                    divchoice2.appendChild(current_shape);
                    divchoice2.appendChild(shape_select_ul);
                    // <input type="text" class="form-control" value="this is a test" aria-label="..." style="color: #FF0000" readonly>
                    opt2 = unique_node_csv_data_t[index][jndex];
                    if(opt2 == "") {
                        opt2 = "Null";  // if null then a half height box is presented
                    }
                    var inputEl = document.createElement("input");
                    inputEl.classList.add("form-control");
                    inputEl.setAttribute("value",opt2);
                    inputEl.setAttribute("aria-label","...");
                    inputEl.setAttribute("csv_index",index);  // add this so we know what to change upon selection or update
                    inputEl.setAttribute("unique_index",jndex);  // add this so we know what to change upon selection or update
                    // inputEl.setAttribute("style","color:" + colors[jndex]); don't color for now (even though it looks nice)
                    inputEl.setAttribute("readonly","true");
                    divchoice1.appendChild(divchoice2);
                    divchoice1.appendChild(inputEl);
                    divchoice.appendChild(divchoice1);
                }
                docfrag.appendChild(divchoice);
            }
        }
        // create the node shape 'reset' selection
        var link = document.createElement("a");
        var text = document.createTextNode(" ");
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-1");
        link.setAttribute("data-parent","#cnShSubMenu");
        docfrag.appendChild(link);
        shapeDropdown.appendChild(docfrag);
        // hook up updates and box to display selection
        $('#shapebox').val(nodeShapeSelect);  
        $('#cnShSubMenu > a').on('click', function(){
            // the following two lines set a box containing the chosen csv column.  This box no longer exists - so comment these for now
            //console.log("the shape box text is: " + $(this).children('a').clone().children().remove().end().text());
            //$('#shapebox').val($(this).children('a').clone().children().remove().end().text());
            console.log("shape csv column chosen");
            if(nodeShapeSelect != $(this).text()) {
                nodeShapeSelect = $(this).text();
                //$( this ).parent().prev().text("Shape (" + nodeShapeSelect + ")");
                $('#shapebox').val(nodeShapeSelect);  
      // xxxera
                // set the size since shapes come in larger than dots
                updateNodeSizeSelect(nodeSizeCSVIndex);
                updateNodeShapeSelect1($(this).attr("csv_index"));
            }
        });


        // node opacity
        console.log("creating node opacity html");
        var opacityDropdown = document.getElementById("cnOpSubMenu");
        var docfrag = document.createDocumentFragment();
        // now add list entries that depend on csv headers
        var min_csv;
        var max_csv;
        for(index = 0; index < node_csv_data_header.length; index++) {
            // since opacity is a continuous value from zero to one only include continuous variables
            if( node_csv_data_type[index] == "num") { 
                min_csv = min_node_csv_data.get(Number(index));
                max_csv = max_node_csv_data.get(Number(index));
                // do not provide selections without a range in values
                if(max_csv > min_csv) {
                    opt = node_csv_data_header[index];
                    var link = document.createElement("a");
                    var text = document.createTextNode(opt);
                    link.appendChild(text);
                    link.href = "#";
                    link.classList.add("list-group-item");
                    link.setAttribute("csv_index",index);
                    link.setAttribute("data-parent","#cnOpSubMenu");
                    docfrag.appendChild(link);
                }
            }
        }
        // create the node opacity 'reset' selection
        var link = document.createElement("a");
        var text = document.createTextNode(" ");
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-1");
        link.setAttribute("data-parent","#cnOpSubMenu");
        docfrag.appendChild(link);
        opacityDropdown.appendChild(docfrag);
        // hook up updates and box to display selection
        $('#opacitybox').val(nodeOpacitySelect);
        $('#cnOpSubMenu a').on('click', function(){
            $('#opacitybox').val($(this).text());
            if(nodeOpacitySelect != $(this).text()) {
                nodeOpacitySelect = $(this).text();
                //$( this ).parent().prev().text("Opacity (" + nodeOpacitySelect + ")");
                $('#opacitybox').val(nodeOpacitySelect);
                updateNodeOpacitySelect($(this).attr("csv_index"));
            }
        });
    
        // node tooltip
        console.log("creating node tooltip html");
        var tooltipDropdown = document.getElementById("cnTtSubMenu");
        var docfrag = document.createDocumentFragment();
        // now add list entries that depend on csv headers
        for (index = 0; index < node_csv_data_header.length; index++) {
            opt = node_csv_data_header[index];
            var link = document.createElement("a");
            var text = document.createTextNode(opt);
            link.appendChild(text);
            link.href = "#";
            link.classList.add("list-group-item");
            link.setAttribute("csv_index",index);
            link.setAttribute("data-parent","#cnTtSubMenu");
            docfrag.appendChild(link);
        }
        // create the node tooltip 'color name' selection
        var link = document.createElement("a");
        var text = document.createTextNode("color name");
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-2");
        link.setAttribute("data-parent","#cnTtSubMenu");
        docfrag.appendChild(link);
        tooltipDropdown.appendChild(docfrag);
        // create the node tooltip 'reset' selection
        var link = document.createElement("a");
        var text = document.createTextNode(" "); // for now put a blank in the box.  xxxera there is a prob with height of box here
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-1");
        link.setAttribute("data-parent","#cnTtSubMenu");
        docfrag.appendChild(link);
        tooltipDropdown.appendChild(docfrag);
        // hook up updates and box to display selection
        $('#tooltipbox').val(nodeTooltipSelect);
        $('#cnTtSubMenu a').on('click', function(){
            $('#tooltipbox').val($(this).text());
            if(nodeTooltipSelect != $(this).text()) {
                nodeTooltipSelect = $(this).text();
                //$( this ).parent().prev().text("Tooltip (" + nodeTooltipSelect + ")");
                $('#tooltipbox').val(nodeTooltipSelect);
                updateNodeTooltipSelect($(this).attr("csv_index"));
            }
        });

        // kickoff shape dropdown changes in vis display
        $('#cnShSubMenu > div > div > div > ul > li > a').on('click', function() {
            // change the text to reflect the selection
            // var currentText = $(this).parent().prev().text();
            var currentSelection = $(this).attr("shape_index");
            // get the csv and unique indexes
            console.log("currentSelection is: " + currentSelection);
            // now update the dropdown selector itself
            $(this).parent().parent().prev().html(shapes[currentSelection]); // safe cause text comes from internal javascript array
            // change the shape in the vis display for this combination of csv_index and unique_index
            var info_item = $(this).parent().parent().parent().next();
            // set the size since shapes come in larger than dots
            updateNodeSizeSelect(nodeSizeCSVIndex);
            updateNodeShapeSelect2(info_item.attr("csv_index"),info_item.attr("unique_index"),currentSelection);
        });
    
        // kickoff color dropdown changes in vis display
        $('select[id^="colorselector"]').colorselector({
            callback: function (value, color, title, context) {
                console.log("color changed - value is: " + value + " - color is: " + color + " - title is: " + title + " - context is: " + context);
                // var jvalue = JSON.parse(value);
                //$( this ).parent().parent().next().css({'color': color});  // xxxera parent() is null for some reason???
                // workaround using the value parameter and title
                var contextArr = context.split('-');
                var csv_index = contextArr[1];
                var unique_index = contextArr[2];
                var color_index = value;
                console.log("item to be updated has csv_index: " + csv_index + " and unique_index: " + unique_index);
                // and update the color of the unique_id display text
                // this works in the debugger $("input[csv_index=6][unique_index=1]").css('color','red');
                // the following jquery search strings come back with syntax error - can't figure 
                // var jquerySelector = '"input[csv_index=' + csv_index + '][unique_index=' + unique_index + ']"';
                // var jquerySelector = '"input[csv_index=\'' + csv_index + '\'][unique_index=\'' + unique_index + '\']"';
                // console.log(jquerySelector);
                // $( jquerySelector ).css('color', colors[unique_index]);
                // $(jquerySelector).css('color', 'red');

                // so do this another way
                // search for the color dropdown then look through all the input elements 
                // for the right csv_index, unique_index combo
                var inputz = document.getElementById("cnCoSubMenu").getElementsByTagName("input");
                // loop over all input_items
                for(var i = 0; i < inputz.length; i++) {
                    if(inputz[i].getAttribute("csv_index") == csv_index) {
                        if(inputz[i].getAttribute("unique_index") == unique_index) {
                            console.log("found input element with csv_index=" + csv_index + " and unique_index=" + unique_index + " for the color dropdown.");
                            inputz[i].setAttribute("style","color:" + colors[color_index]);
                            break;
                        }
                    }
                }
                updateNodeColorSelect2(csv_index,unique_index,color_index);
            }
        });
    } // no node data cause no node csv file provided
    
    // edge csv provided
    // if(typeof edge_csv_data_header !== 'undefined') { // use the edge data provided
    // use the following line instead of the previous line.  Reason being that there is always an edge_csv_data_header
    // however in the case of no edge csv file it only contains id,from,to,length which is not informative.
    if(!isBlank(edge_csv_file)) {
        // and the edge dropdowns
    
        // edge tooltip
        console.log("creating edge tooltip html");
        var tooltipDropdown = document.getElementById("ceTtSubMenu");
        var docfrag = document.createDocumentFragment();
        // now add list entries that depend on csv headers
        for (index = 0; index < edge_csv_data_header.length; index++) {
            opt = edge_csv_data_header[index];
            var link = document.createElement("a");
            var text = document.createTextNode(opt);
            link.appendChild(text);
            link.href = "#";
            link.classList.add("list-group-item");
            link.setAttribute("csv_index",index);
            link.setAttribute("data-parent","#cnTtSubMenu");
            docfrag.appendChild(link);
        }
        // create the edge tooltip 'color name' selection
        var link = document.createElement("a");
        var text = document.createTextNode("color name"); 
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-2");
        link.setAttribute("data-parent","#cnTtSubMenu");
        docfrag.appendChild(link);
        tooltipDropdown.appendChild(docfrag);
        // create the edge tooltip 'reset' selection
        var link = document.createElement("a");
        var text = document.createTextNode(" "); // for now put a blank in the box.  xxxera there is a prob with height of box here
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-1");
        link.setAttribute("data-parent","#cnTtSubMenu");
        docfrag.appendChild(link);
        tooltipDropdown.appendChild(docfrag);
        // hook up updates and box to display selection
        $('#edgetooltipbox').val(edgeTooltipSelect);
        $('#ceTtSubMenu a').on('click', function(){
            $('#edgetooltipbox').val($(this).text());
            if(edgeTooltipSelect != $(this).text()) {
                edgeTooltipSelect = $(this).text();
                //$( this ).parent().prev().text("Tooltip (" + edgeTooltipSelect + ")");
                $('#edgetooltipbox').val(edgeTooltipSelect);
                updateEdgeTooltipSelect($(this).attr("csv_index"));
            }
        });
    
        // edge width
        console.log("creating edge width html");
        var widthDropdown = document.getElementById("ceWiSubMenu");
        var docfrag = document.createDocumentFragment();
        // now add list entries that depend on csv headers
        for(index = 0; index < edge_csv_data_header.length; index++) {
            if( edge_csv_data_type[index] == "num" ) {
                opt = edge_csv_data_header[index];
                var link = document.createElement("a");
                var text = document.createTextNode(opt);
                link.appendChild(text);
                link.href = "#";
                link.classList.add("list-group-item");
                link.setAttribute("csv_index",index);
                link.setAttribute("data-parent","#ceWiSubMenu");
                docfrag.appendChild(link);
            }
        }
        // create the edge width 'reset' selection
        var link = document.createElement("a");
        var text = document.createTextNode(" ");
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-1");
        link.setAttribute("data-parent","#ceWiSubMenu");
        docfrag.appendChild(link);
        widthDropdown.appendChild(docfrag);
        // hook up updates and box to display selection
        $('#widthbox').val(edgeWidthSelect);
        $('#ceWiSubMenu a').on('click', function(){
            $('#widthbox').val($(this).text());
            if(edgeWidthSelect != $(this).text()) {
                edgeWidthSelect = $(this).text();
                //$( this ).parent().prev().text("Size (" + edgeWidthSelect + ")");
                $('#widthbox').val(edgeWidthSelect);
                updateEdgeWidthSelect($(this).attr("csv_index"));
            }
        });
    
        // edge color
        console.log("creating edge color html");
        var colorDropdown = document.getElementById("ceCoSubMenu");
        var docfrag = document.createDocumentFragment();
        // now add list entries that depend on csv headers
        // loop over all possible variables (csv column header elements)
        for (index = 0; index < edge_csv_data_header.length; index++) {
            // skip csv column as a color selection parameter if it has too 
            // many data values (only a certain number of colors are easily seen)
            if(unique_edge_csv_data_t[index].length <= colors.length) {
                // create the menu items that are the column headers
                // <a href="#SubSubMenu1" class="list-group-item strong" data-toggle="collapse" data-parent="#ceCoSubMenu"><i class="glyphicon glyphicon-user"></i>Column Header 1<i class="fa fa-caret-down"></i></a>
                opt = edge_csv_data_header[index];
                var link = document.createElement("a");
                // var text = document.createTextNode("<i class='glyphicon glyphicon-user'></i>" + opt + "<i class='fa fa-caret-down'></i>");  // contains "Column Header 1" (with the html enamoration before and after) for instance
                var text = document.createTextNode(opt);  // contains "Column Header 1" (with the html enamoration before and after) for instance
                link.appendChild(text);
                link.href = "#" + "ceCoSubMenuIndex" + index;  // refers to id on div immediately below
                link.classList.add("list-group-item");
                link.classList.add("strong");
                link.setAttribute("csv_index",index);  // add this so we know what to change upon selection or update
                link.setAttribute("data-parent","#ceCoSubMenu"); // this refers to the parent div above
                link.setAttribute("data-toggle","collapse");
                docfrag.appendChild(link);
                // now add the unique items for each column (and allow a color select for each one)
                // first step is to add a div which controls the dropdown
                // <div class="collapse list-group-submenu list-group-submenu-1" id="ceCoSubMenuIndex1">
                var divchoice = document.createElement("div");
                divchoice.classList.add("collapse");
                divchoice.classList.add("list-group-submenu");
                divchoice.classList.add("list-group-submenu-1");
                divchoice.setAttribute("id", "ceCoSubMenuIndex" + index );
                // loop over all the unique entries in each column
                for (jndex = 0; jndex < unique_edge_csv_data_t[index].length; jndex++) {
                    // now create an input-group div to bind the text entry and the dropdown together
                    // <div class="input-group" data-parent="#ceCoSubMenuIndex1">
                    var divchoice1 = document.createElement("div");
                    divchoice1.classList.add("input-group");
                    divchoice1.setAttribute("data-parent","#ceCoSubMenuIndex" + index);
                    // now create the input-group-btn for the dropdown
                    // <div class="input-group-btn">
                    var divchoice2 = document.createElement("div");
                    divchoice2.classList.add("input-group-btn");
                    // now create the select html tag
                    // <select id="edgecolorselector1" class="list-group-item">
                    var select = document.createElement("select");
                    select.setAttribute("id","edgecolorselector" + jndex);
                    select.classList.add("list-group-item");
                    // now add all the colors as options under the select html tag
                    for(kndex = 0; kndex < colors.length; kndex++) {
                        // <option value="107" data-color="#A0522D">sienna</option>
                        var option = document.createElement("option");
                        // prepare to pass the csv_index and the unique_index to the onclick function
                        // append color name with csv_index-unique_index
                        var text2 = document.createTextNode(colorNames[kndex]); 
                        option.appendChild(text2);
                        // set attribute to json string containing identifying parameters for selector - tried this it doesn't work
                        // var passJsoc = '{"csv_index":"' + index + '", "unique_index":"' + jndex + '"}';
                        // put an index into the color array in the value attribute
                        option.setAttribute("value",kndex);  // the plugin requies a unique value
                        option.setAttribute("data-color",colors[kndex]);
                        option.setAttribute("color-control-context","context_index_jndex-"+index+"-"+jndex);
                        // <option value="48" data-color="#CD5C5C" selected="selected">indianred</option>
                        if(kndex == jndex) {
                            option.setAttribute("selected","selected");
                        }
                        select.appendChild(option);
                    }
                    divchoice2.appendChild(select);
                    // <input type="text" class="form-control" value="this is a test" aria-label="..." style="color: #FF0000" readonly>
                    opt2 = unique_edge_csv_data_t[index][jndex];
                    if(opt2 == "") {
                        opt2 = "Null";  // if null then a half height box is presented
                    }
                    var inputEl = document.createElement("input");
                    inputEl.classList.add("form-control");
                    inputEl.setAttribute("value",opt2);
                    inputEl.setAttribute("aria-label","...");
                    inputEl.setAttribute("csv_index",index);  // add this so we know what to change upon selection or update
                    inputEl.setAttribute("unique_index",jndex);  // add this so we know what to change upon selection or update
                    inputEl.setAttribute("style","color:" + colors[jndex]); 
                    inputEl.setAttribute("readonly","true");
                    divchoice1.appendChild(divchoice2);
                    divchoice1.appendChild(inputEl);
                    divchoice.appendChild(divchoice1);
                }
                docfrag.appendChild(divchoice);
            }
        }
        // create the edge color 'reset' selection
        var link = document.createElement("a");
        var text = document.createTextNode(" ");
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-1");
        link.setAttribute("data-parent","#ceCoSubMenu");
        docfrag.appendChild(link);
        colorDropdown.appendChild(docfrag);
        // hook up updates and box to display selection
        $('#edgecolorbox').val(edgeColorSelect);
        $('#ceCoSubMenu > a').on('click', function(){
            // console.log("the color box text is: " + $(this).children('a').clone().children().remove().end().text());
            //$('#edgecolorbox').val($(this).text()); // doesn't work gets all child text as well
            // $('#edgecolorbox').val($(this).children('a').clone().children().remove().end().text());
            //console.log("in on click that calls updateEdgeColorSelect1");
            if(edgeColorSelect != $(this).text()) {
                edgeColorSelect = $(this).text();
                //$( this ).parent().prev().text("Color (" + edgeColorSelect + ")");
                $('#edgecolorbox').val(edgeColorSelect);
                updateEdgeColorSelect1($(this).attr("csv_index"));
            }
        });
    
        // edge dashes
        console.log("creating edge dashes html");
        var dashDropdown = document.getElementById("ceDaSubMenu");
        var docfrag = document.createDocumentFragment();
        // now add list entries that depend on csv headers
        // loop over all possible variables (csv column header elements)
        for (index = 0; index < edge_csv_data_header.length; index++) {
            // skip csv column as a dash selection parameter if it has too
            // many data values (only a certain number of dashes are available in vis.js)
            if( (edge_csv_data_type[index] == "str") && (unique_edge_csv_data_t[index].length <= dashes.length) ) {
                // create the menu items that are the dash headers
                // <a href="#SubSubMenu1" class="list-group-item strong" data-toggle="collapse" data-parent="#ceDaSubMenu"><i class="glyphicon glyphicon-user"></i>Column Header 1<i class="fa fa-caret-down"></i></a>
                opt = edge_csv_data_header[index];
                var link = document.createElement("a");
                // var text = document.createTextNode("<i class='glyphicon glyphicon-user'></i>" + opt + "<i class='fa fa-caret-down'></i>");  // contains "Column Header 1" (with the html enamoration before and after) for instance
                var text = document.createTextNode(opt);  // contains "Column Header 1" (with the html enamoration before and after) for instance
                link.appendChild(text);
                link.href = "#" + "ceDaSubMenuIndex" + index;  // refers to id on div immediately below
                link.classList.add("list-group-item");
                link.classList.add("strong");
                link.setAttribute("csv_index",index);  // add this so we know what to change upon selection or update
                link.setAttribute("data-parent","#ceDaaubMenu"); // this refers to the parent div above
                link.setAttribute("data-toggle","collapse");
                docfrag.appendChild(link);
                // now add the unique items for each column (and allow a dash select for each one)
                // first step is to add a div which controls the dropdown
                // <div class="collapse list-group-submenu list-group-submenu-1" id="ceDaSubMenuIndex1">
                var divchoice = document.createElement("div");
                divchoice.classList.add("collapse");
                divchoice.classList.add("list-group-submenu");
                divchoice.classList.add("list-group-submenu-1");
                divchoice.setAttribute("id", "ceDaSubMenuIndex" + index );
                // loop over all the unique entries in each column
                for (jndex = 0; jndex < unique_edge_csv_data_t[index].length; jndex++) {
                    // now create an input-group div to bind the text entry and the dropdown together
                    // <div class="input-group" data-parent="#ceDaSubMenuIndex1">
                    var divchoice1 = document.createElement("div");
                    divchoice1.classList.add("input-group");
                    divchoice1.setAttribute("data-parent","#ceDaaubMenuIndex" + index);
                    // now create the input-group-btn for the dropdown
                    // <div class="input-group-btn">
                    var divchoice2 = document.createElement("div");
                    divchoice2.classList.add("input-group-btn");
                    // now create the button with graphic indicating dash 
                    var current_dash = document.createElement("button");
                    var text2insert = dashes[jndex];
                    current_dash.innerHTML = text2insert;
                    current_dash.setAttribute("title",dashSpecs[jndex]);
                    current_dash.classList.add("btn");
                    current_dash.classList.add("btn-default");
                    current_dash.classList.add("dropdown-toggle");
                    current_dash.setAttribute("data-toggle","dropdown");
                    current_dash.setAttribute("aria-haspopup","true");
                    current_dash.setAttribute("aria-expanded","false");
                    /// including these (///) makes the onclick action in (
                    /// $('#ceDaSubMenu > div > div > div > ul > li > a' ) not work below - so remove for now - makes more similar to color anyway
                    ///var carrot = document.createElement("span"); 
                    ///carrot.classList.add("caret");
                    ///current_dash.appendChild(carrot);
                    // <ul class="dropdown-menu">
                    var dash_select_ul = document.createElement("ul");
                    dash_select_ul.classList.add("dropdown-menu");
                    // now add all the dash types as selections under the dash ul dropdown menu
                    for(kndex = 0; kndex < dashes.length; kndex++) {
                        // <li><a href="#">&#9671;</a></li>
                        var link2 = document.createElement("a");
                        var text2insert2 = dashes[kndex] + " ";
                        link2.innerHTML = text2insert2; // safe cause text comes from internal javascript array
                        link2.setAttribute("href","#");
                        // prepare to pass the csv_index, unique_index, and dash info to the onclick function
                        link2.setAttribute("dash_index",kndex);  // the plugin requies a unique value
                        link2.setAttribute("title",dashSpecs[kndex]);
                        var li = document.createElement("li");
                        li.appendChild(link2);
                        dash_select_ul.appendChild(li);
                    }
                    divchoice2.appendChild(current_dash);
                    divchoice2.appendChild(dash_select_ul);
                    // <input type="text" class="form-control" value="this is a test" aria-label="..." style="color: #FF0000" readonly>
                    opt2 = unique_edge_csv_data_t[index][jndex];
                    if(opt2 == "") {
                        opt2 = "Null";  // if null then a half height box is presented
                    }
                    var inputEl = document.createElement("input");
                    inputEl.classList.add("form-control");
                    inputEl.setAttribute("value",opt2);
                    inputEl.setAttribute("aria-label","...");
                    inputEl.setAttribute("csv_index",index);  // add this so we know what to change upon selection or update
                    inputEl.setAttribute("unique_index",jndex);  // add this so we know what to change upon selection or update
                    // inputEl.setAttribute("style","color:" + colors[jndex]); don't color for now (even though it looks nice)
                    inputEl.setAttribute("readonly","true");
                    divchoice1.appendChild(divchoice2);
                    divchoice1.appendChild(inputEl);
                    divchoice.appendChild(divchoice1);
                }
                docfrag.appendChild(divchoice);
            }
        }
        // create the edge dashes 'reset' selection
        var link = document.createElement("a");
        var text = document.createTextNode(" ");
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-1");
        link.setAttribute("data-parent","#ceDaSubMenu");
        docfrag.appendChild(link);
        dashDropdown.appendChild(docfrag);
        // hook up updates and box to display selection
        $('#dashtypebox').val(edgeDashSelect);  
        $('#ceDaSubMenu > a').on('click', function(){
            // the following two lines set a box containing the chosen csv column.  This box no longer exists - so comment these for now
            //console.log("the dash box text is: " + $(this).children('a').clone().children().remove().end().text());
            //$('#dashtypebox').val($(this).children('a').clone().children().remove().end().text());
            console.log("dash csv column chosen");
            if(edgeDashSelect != $(this).text()) {
                edgeDashSelect = $(this).text();
                //$( this ).parent().prev().text("Dash (" + edgeDashSelect + ")");
                $('#dashtypebox').val(edgeDashSelect);  
                updateEdgeDashSelect1($(this).attr("csv_index"));
            }
        });
    
        // edge opacity
        console.log("creating edge opacity html");
        var opacityDropdown = document.getElementById("ceOpSubMenu");
        var docfrag = document.createDocumentFragment();
        // now add list entries that depend on csv headers
        var min_csv;
        var max_csv;
        for(index = 0; index < edge_csv_data_header.length; index++) {
            // since opacity is a continuous value from zero to one only include continuous variables
            if( edge_csv_data_type[index] == "num") { 
                min_csv = min_edge_csv_data.get(Number(index));
                max_csv = max_edge_csv_data.get(Number(index));
                // do not provide selections without a range in values
                if(max_csv > min_csv) {
                    opt = edge_csv_data_header[index];
                    var link = document.createElement("a");
                    var text = document.createTextNode(opt);
                    link.appendChild(text);
                    link.href = "#";
                    link.classList.add("list-group-item");
                    link.classList.add("strong");
                    link.setAttribute("csv_index",index);
                    link.setAttribute("data-parent","#ceOpSubMenu");
                    docfrag.appendChild(link);
                }
            }
        }
        // create the edge opacity 'reset' selection
        var link = document.createElement("a");
        var text = document.createTextNode(" ");
        link.appendChild(text);
        link.href = "#";
        link.classList.add("list-group-item");
        link.setAttribute("csv_index","-1");
        link.setAttribute("data-parent","#ceOpSubMenu");
        docfrag.appendChild(link);
        opacityDropdown.appendChild(docfrag);
        // hook up updates and box to display selection
        $('#edgeopacitybox').val(edgeOpacitySelect);
        $('#ceOpSubMenu a').on('click', function(){
            $('#edgeopacitybox').val($(this).text());
            if(edgeOpacitySelect != $(this).text()) {
                edgeOpacitySelect = $(this).text();
                //$( this ).parent().prev().text("Opacity (" + edgeOpacitySelect + ")");
                $('#edgeopacitybox').val(edgeOpacitySelect);
                updateEdgeOpacitySelect($(this).attr("csv_index"));
            }
        });
    
        // kickoff shape dropdown changes in vis display
        $('#ceDaSubMenu > div > div > div > ul > li > a').on('click', function() {
            // change the text to reflect the selection
            // var currentText = $(this).parent().prev().text();
            var currentSelection = $(this).attr("dash_index");
            // get the csv and unique indexes
            console.log("currentSelection is: " + currentSelection);
            // now update the dropdown selector itself
            $(this).parent().parent().prev().html(dashes[currentSelection]); // safe cause text comes from internal javascript array
            // change the shape in the vis display for this combination of csv_index and unique_index
            var info_item = $(this).parent().parent().parent().next();
            updateEdgeDashSelect2(info_item.attr("csv_index"),info_item.attr("unique_index"),currentSelection);
        });
    
        // kickoff color dropdown changes in vis display
        $('select[id^="edgecolorselector"]').colorselector({
            callback: function (value, color, title, context) {
                console.log("color changed - value is: " + value + " - color is: " + color + " - title is: " + title + " - context is: " + context);
                // var jvalue = JSON.parse(value);
                //$( this ).parent().parent().next().css({'color': color});  // xxxera parent() is null for some reason???
                // workaround using the value parameter and title
                var contextArr = context.split('-');
                var csv_index = contextArr[1];
                var unique_index = contextArr[2];
                var color_index = value;
                console.log("item to be updated has csv_index: " + csv_index + " and unique_index: " + unique_index);
                // and update the color of the unique_id display text
                // this works in the debugger $("input[csv_index=6][unique_index=1]").css('color','red');
                // the following jquery search strings come back with syntax error - can't figure 
                // var jquerySelector = '"input[csv_index=' + csv_index + '][unique_index=' + unique_index + ']"';
                // var jquerySelector = '"input[csv_index=\'' + csv_index + '\'][unique_index=\'' + unique_index + '\']"';
                // console.log(jquerySelector);
                // $( jquerySelector ).css('color', colors[unique_index]);
                // $(jquerySelector).css('color', 'red');

                // so do this another way
                // search for the color dropdown then look through all the input elements 
                // for the right csv_index, unique_index combo
                var inputz = document.getElementById("ceCoSubMenu").getElementsByTagName("input");
                // loop over all input_items
                for(var i = 0; i < inputz.length; i++) {
                    if(inputz[i].getAttribute("csv_index") == csv_index) {
                        if(inputz[i].getAttribute("unique_index") == unique_index) {
                            console.log("found input element with csv_index=" + csv_index + " and unique_index=" + unique_index + " for the color dropdown.");
                            inputz[i].setAttribute("style","color:" + colors[color_index]);
                            break;
                        }
                    }
                }
                updateEdgeColorSelect2(csv_index,unique_index,color_index);
            }
        });
    } // end of edge-csv data processing
    
    // slider control for threshold initialization
    // use bootstrapSlider due to name collision with jquery-ui
    $("#ex4").bootstrapSlider({
        id: "ex4Slider",
        tooltip: "show",
        precision: 3
    });
    $("#ex4").on("slide", function(slideEvt) {
        if(slideEvt.value != threshold) {
            threshold = slideEvt.value;
            updateThresholdSelect(threshold);
        }
    });
    
    // slider control for size scaling
    $("#ex5").bootstrapSlider({
        id: "ex5Slider",
        tooltip: "show",
        precision: 1
    });
    $("#ex5").on("slide", function(slideEvt) {
        if(slideEvt.value != sizeScale) {
            sizeScale = slideEvt.value;
            updateSizeScale();
        }
    });
}

function restoreJsonDebug() {
    var node_csv_file;
    var node_csv_data;
    var node_csv_data_header;
    var datatable_data_header;
    var unique_node_csv_data_t;
    var node_csv_data_type;
    var read_from_debug = false;
    if(read_from_debug) {
        console.log("Reading in debug json files");
        node_csv_file = require("../debug_json/node_csv_file.json");
        node_csv_data = require("../debug_json/node_csv_data.json");
        node_csv_data_header = require("../debug_json/node_csv_data_header.json");
        datatable_data_header = require("../debug_json/datatable_data_header.json");
        unique_node_csv_data_t = require("../debug_json/unique_node_csv_data_t.json");
        node_csv_data_type = require("../debug_json/node_csv_data_type.json");
        // python_data contains hivtrace test output data for debug purposes
        //python_data = require("../debug_json/network.json");
    }
}
