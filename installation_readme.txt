
Thank you for installing NetView HIV.


To run the program, click the program icon from your 'Start Menu' | 'NetView HIV' application folder.

Select a 'node CSV' and a multiple sequence FASTA file as input.  The CSV (comma separated value) file must conform to RFC 4180 ( see https://tools.ietf.org/html/rfc4180 ).  An easy way to generate this file from MS Excel is to 'save-as' with filetype 'CSV (MS-DOS) *.csv'.  FASTA files must contain standard nucleotide sequences in IUPAC format (see http://zhanglab.ccmb.med.umich.edu/FASTA/ ).

The node CSV file contains auxiliary data that pertains to the FASTA sequences in the FASTA file.  In order to link information from the two files, entries in the first column of the node CSV file must match the names of the FASTA sequences (everything after the '>' and before any space in each FASTA entry's header) you input via a selected FASTA file.  Alternatively, FASTA names may be stored in the CSV file in any column with column header named 'ID'.  If more than one 'ID' column exists the first one (left most) will be used.

As an alternative input to FASTA file entry, a list of edges may be provided which indicate connection between the nodes defined in the node CSV file.  This is called an 'edge CSV' file.  Also, if no auxiliary information is available, then it is not necessary to input a node CSV file.

FASTA Names (IDs) in the CSV file must be unique (non-repeated).  Identical names in the FASTA file are automatically appended by hivtrace with '_#' characters to make them unique.  They will be tagged with these appended names in the network display.

After the input files are processed, a network diagram will be displayed which links FASTA objects.  You may adjust the display parameters in the network via a slideout menu in the upper left of the network display.  Nodes may be annotated with any column of the 'node CSV' file and edges may be annotated with any column of the 'edge CSV' file.  

A geographical map for subjects tagged in the node CSV file with headers named 'LAT' and 'LONG' can be accessed via a slideout tab on the right side of the network display.  

A spreadsheet is provided below the network displaying data from the node CSV file.  Searches over all CSV textual entries may be performed.  Clicking on the column headers will sort all rows according to that column's data.  Currently selected nodes in the network display will be sorted to the top of the spreadsheet.  Selecting rows in the spreadsheet will highlight corresponding nodes in the network and geographic displays.



We hope this tool will be useful to your analysis efforts.



- The CDC HIV group.
