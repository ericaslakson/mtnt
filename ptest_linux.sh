#!/bin/bash
source ../app/setvars.sh
source ../app/setpath.sh
hivtrace -i /opt/mtnt_oct_31/mtnt/linux_python/../STOP_combined_5-21-15_BS-aligned.fasta -a 500 -r HXB2_pol -t .015 -m 500 -g .05
