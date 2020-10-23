# mtnt

This code is a tool to help HIV contact tracers do cluster analysis and tracing of subjects with HIV.  The tool was designed to be used locally so that no patient data goes through the internet.  Sequenced HIV data from patients is supplied to the system in FASTA file format along with metadata about these patients  in a csv file.  The metadata input csv file allows arbitrarily large metadata datasets to be used to annotate edges and objects data plotted on a diagram.  It also allows geographics mapping to be done using optional lat long patient data in the metadata file.  The metadata spreadsheet itself is visible in a grid view and all 3 views can be presented to the user simultaneously with synchronized updates between the views.

To install follow these steps:

Install bower, npm, and nodejs (Note project developed with version nwjs-v0.12.3-linux-x64 and nwjs-v0.12.3-win-x64)

Then get the gui elements: 

$ npm install package.json
$ bower install bootstrap-drawer bootstrap3-dialog bootstrap-fileinput

The genetic similarity is calculate with a python program called hivtrace.  To install it:

$ pip3 install hivtrace

As this install can be problematic you may follow instructions in the 'linux_installation_notes.txt' and 'build_hivtrace.sh' files to build hivtrace locally.

Remember to overlay the file hivtrace.py inside your locally built hivtrace package with the hivtrace.py here in order to solve an installation problem.

While running, node.js creates a python interpretor in order to calculate the genetic similarity of strains of HIV found in people referenced in a FASTA input file which it then uses to layout objects on the edge-object view.

Due to privacy concerns test fasta data and related metadata csv files are not provided here.  In order to join the FASTA data to the CSV rows provide a patient name for joining the two files.  For example:

rows in FASTA FILE:
>180_0506_TG_2006_BG_het
ACTCT... etc ...GCCA

row in csv file:
ID	                    year	riskFactor	location	lat	      lon
180_0506_TG_2006_BG_het	2006	HET	        Dobrich	  43.57484	27.828056


