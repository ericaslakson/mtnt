#!/bin/bash
fasta_input=${1}
threshold_input=${2}
source setvars.sh
source setpath.sh
hivtrace -i ${fasta_input} -a 500 -r HXB2_pol -t ${threshold_input} -m 500 -g .05
