#!/bin/bash
FASTA="$(cygpath -u "${1}")";
hivtrace -i ${FASTA} -a 500 -r HXB2_pol -t $2 -m 500 -g .05
