#!/bin/bash
# the purpose of this script is to clean a built directory to prepare for a release

# get current directory for use below
cwd=`pwd`

# clean from last time
if [ -d $cwd/bin ]
  then
    sudo rm -rf bin
    sudo rm -rf include
    sudo rm -rf share
    sudo rm -rf lib
    sudo rm -rf Support
fi

if [ -f $cwd/../app/ptest_linux.sh ]
  then
    sudo rm -rf $cwd/../app/ptest_linux.sh
fi

if [ -f $cwd/hivtrace.log ]
  then
    sudo rm -rf $cwd/hivtrace.log
fi

if [ -f $cwd/../app/setvars.sh ]
  then
    sudo rm -rf $cwd/../app/setvars.sh
fi

if [ -f $cwd/../app/setpath.sh ]
  then
    sudo rm -rf $cwd/../app/setpath.sh
fi

if [ -f $cwd/../app/runHivtrace_linux.sh ]
  then
    sudo rm -rf $cwd/../app/runHivtrace_linux.sh
fi

if [ -f $cwd/Python-3.4.4.tgz ]
  then
    sudo rm -rf $cwd/Python-3.4.4
fi
