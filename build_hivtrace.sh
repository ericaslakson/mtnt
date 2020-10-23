#!/bin/bash
cd ./python_packages
unzip ./tn93-master.zip
cd ./tn93-master
cmake ./
make
cp *.exe /usr/local/bin
cd ..
rm -rf ./tn93-master
pwd
easy_install-3.4 pip-7.1.2.tar.gz

# for scipy
pip3 install numpy-1.9.2.tar.gz 
# previous line output should say already satisfied
pip3 install pysam-0.8.4-era.tar.gz
pip3 install biopython-1.66.tar.gz
pip3 install Cython-0.23.4.tar.gz
pip3 install scipy-0.15.0.tar.gz

# for matplotlib
pip3 install six-1.10.0.tar.gz
pip3 install cycler-0.9.0.tar.gz
pip3 install pyparsing-2.0.6.tar.gz
pip3 install python-dateutil-2.4.2.tar.gz
pip3 install pytz-2015.7.tar.gz
pip3 install matplotlib-1.5.0.tar.gz

# BioExt
pip3 install BioExt-0.18.0.tar.gz

# for hivtrace
tar -xvf hyphy-2.2.6era2.tar.gz
cd hyphy-2.2.6
# following to fix a warning about wrong paths in CMakeCache.txt
rm CMakeCache.txt
cmake ./
make HYPHYMP
make install
cd ..
rm -rf hyphy-2.2.6/
pip3 install fakemp-0.9.1.tar.gz
pip3 install hyphy-python-0.1.3era.tar.gz
pip3 install hppy-0.9.6era2.tar.gz
pip3 install hivclustering-1.2.3.tar.gz
pip3 install hivtrace-0.1.4.tar.gz

# next install extra python packages needed for layouts
pip3 install scikit-learn-0.17.1.tar.gz
pip3 install pandas-0.18.1.tar.gz
pip3 install snowflake-0.0.2.tar.gz
pip3 install decorator-4.0.10.tar.gz
pip3 install networkx-1.11.tar.gz

# finally copy the slightly altered hivtrace over the installed version
# this copy gives status messages to the javascript gui
# this step not now necessary at the new hivtrace.py has been inserted
# into the hivtrace installation package
#cd ..
#cp app/hivtrace.py cygwin64/lib/python3.4/site-packages/hivtrace/hivtrace.py

# make *.sh executable
cd ..
chmod +x *.sh
chmod +x app/*.sh
