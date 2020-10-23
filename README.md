# mtnt

First get gui elements: install bower, nodejs (Note project developed with version nwjs-v0.12.3-linux-x64 and nwjs-v0.12.3-win-x64)

then 

$ npm install package.json
$ bower install bootstrap-drawer bootstrap3-dialog bootstrap-fileinput

The genetic similarity is calculate with a python program called hivtrace.  To install

$ pip install hivtrace

As this install can be problematic you may follow instructions in the 'linux_installation_notes.txt' and 'build_hivtrace.sh' files to build hivtrace locally.

Remember to overlay the file hivtrace.py inside your locally built hivtrace package in order to solve an installation problem.  

Node.js creates a python interpretor in order to calculate the genetic similarity of strains of HIV found in people referenced in a FASTA input file.

Due to privacy concerns test fasta data and related metadata csv files are not provided.





