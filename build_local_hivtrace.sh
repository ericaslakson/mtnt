#!/bin/bash
# the purpose of this script is to build a standalone python + hivtrace installation on linux (either redhat/centos or debian/ubuntu but right now just ubu)

# Notes for the script to build the files in this directory are as follows...
# https://mail.python.org/pipermail/tutor/2002-March/012903.html

# for ubuntu/debian
# http://tecadmin.net/install-python-3-4-on-ubuntu-and-linuxmint/#
# http://docs.python-guide.org/en/latest/dev/virtualenvs/

sudo apt-get install build-essential checkinstall
sudo apt-get install libreadline-gplv2-dev libncursesw5-dev libssl-dev libsqlite3-dev tk-dev libgdbm-dev libc6-dev libbz2-dev
sudo apt-get install cmake
sudo apt-get install liblapack-dev
sudo apt-get install libopenmpi-dev
sudo apt-get install gcc gfortran g++
sudo apt-get install libpng++-dev
sudo apt-get install libcurl4-openssl-dev
  
#for redhat/centos
# http://g0o0o0gle.com/install-python-3-4-1-centos-6/
# http://toomuchdata.com/2014/02/16/how-to-install-python-on-centos/
# xxxera - maybe get rid of these system libs by installing locally

# get user and group for permissions work below
uid=`id -u`
gid=`id -g`
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

# hyphy needs cmake3 which is not availble on ubuntu 12.04
if [ ! -f $cwd/cmake-3.4.3-Linux-x86_64.tar.gz ]
  then
    cd $cwd && mkdir $cwd/Support && cd $cwd/Support && \ 
    wget --no-check-certificate https://cmake.org/files/v3.4/cmake-3.4.3-Linux-x86_64.tar.gz && \
    tar -xzvf cmake-3.4.3-Linux-x86_64.tar.gz && \
    ./cmake-3.4.3-Linux-x86_64/bin/cmake -version && \
    cd ..
  else
    cd $cwd && mkdir $cwd/Support && cp $cwd/cmake-3.4.3-Linux-x86_64.tar.gz Support && cd $cwd/Support && \ 
    tar -xzvf cmake-3.4.3-Linux-x86_64.tar.gz && \
    ./cmake-3.4.3-Linux-x86_64/bin/cmake -version && \
    cd ..
fi

echo "#!/bin/bash" > $cwd/../app/setvars.sh
echo "#!/bin/bash" > $cwd/../app/setpath.sh
echo "export PATH=$cwd/bin:$PATH" >> $cwd/../app/setpath.sh
echo "alias cmake3='$cwd/Support/cmake-3.4.3-Linux-x86_64/bin/cmake'" >> $cwd/../app/setvars.sh
chmod +x $cwd/../app/setpath.sh
cmake3=$cwd/Support/cmake-3.4.3-Linux-x86_64/bin/cmake

echo "current directory is: "
echo -n `pwd`
cd $cwd
if [ ! -f $cwd/Python-3.4.4.tgz ]
  then
    wget http://www.python.org/ftp/python/3.4.4/Python-3.4.4.tgz
fi

tar -xzvf Python-3.4.4.tgz
cd Python-3.4.4

echo 'about to execute the configure command with text :'
echo './configure --prefix='$cwd 
./configure --prefix=$cwd
make
sudo make altinstall prefix=$cwd exec-prefix=$cwd > build_log.txt 2>&1

cd ..

# make these files for later testing
echo "alias python3='$cwd/bin/python3.4'" >> $cwd/../app/setvars.sh
echo "alias pip3='$cwd/bin/pip3.4'" >> $cwd/../app/setvars.sh
chmod +x $cwd/../app/setvars.sh

# cleanup python build dir
#sudo rm ./Python-3.4.4.tgz
sudo rm -rf $cwd/Python-3.4.4

# fix permissions on built python
sudo chown -R $uid:$gid $cwd/bin
sudo chown -R $uid:$gid $cwd/include
sudo chown -R $uid:$gid $cwd/lib
sudo chown -R $uid:$gid $cwd/share

mypython3=$cwd/bin/python3.4
mypip3=$cwd/bin/pip3.4

#then test
$mypython3 -V
$mypip3 --version

# note that this script assumes it is contained in a folder 
# at the same level as a folder containing source files (python_packages)
# for hivtrace and its required packages 

# now layer in the packages for hivtrace
unzip $cwd/../python_packages/tn93-master.zip -d .
cd ./tn93-master
cmake ./
make
find . -maxdepth 1 -type f -executable -exec cp {} ../bin \;
cd $cwd
rm -rf $cwd/tn93-master

# wget https://pypi.python.org/packages/source/n/numpy/numpy-1.9.2.tar.gz#md5=a1ed53432dbcd256398898d35bc8e645
$mypip3 install $cwd/../python_packages/numpy-1.9.2.tar.gz

cd $cwd
if [ ! -f $cwd/pysam-0.8.4.tar.gz ]
  then
    wget https://pypi.python.org/packages/source/p/pysam/pysam-0.8.4.tar.gz
fi
$mypip3 install pysam-0.8.4.tar.gz
# wget https://pypi.python.org/packages/source/b/biopython/biopython-1.66.tar.gz
$mypip3 install $cwd/../python_packages/biopython-1.66.tar.gz
# wget https://pypi.python.org/packages/source/C/Cython/Cython-0.23.4.tar.gz#md5=157df1f69bcec6b56fd97e0f2e057f6e
$mypip3 install $cwd/../python_packages/Cython-0.23.4.tar.gz
# wget https://sourceforge.net/projects/scipy/files/scipy/0.15.0/scipy-0.15.0.tar.gz/download
$mypip3 install $cwd/../python_packages/scipy-0.15.0.tar.gz

# for matplotlib
# wget https://pypi.python.org/packages/source/s/six/six-1.10.0.tar.gz#md5=34eed507548117b2ab523ab14b2f8b55
$mypip3 install $cwd/../python_packages/six-1.10.0.tar.gz
# wget https://pypi.python.org/packages/source/C/Cycler/cycler-0.9.0.tar.gz#md5=0b418dbaded3aba6021af03246e2f7d0
$mypip3 install $cwd/../python_packages/cycler-0.9.0.tar.gz
# wget https://pypi.python.org/packages/source/p/pyparsing/pyparsing-2.0.6.tar.gz#md5=a2d85979e33a6600148c6383d3d8de67
$mypip3 install $cwd/../python_packages/pyparsing-2.0.6.tar.gz
# wget https://pypi.python.org/packages/source/p/python-dateutil/python-dateutil-2.4.2.tar.gz
$mypip3 install $cwd/../python_packages/python-dateutil-2.4.2.tar.gz
# wget https://pypi.python.org/packages/source/p/pytz/pytz-2015.7.tar.gz#md5=252bb731883f37ff9c7f462954e8706d
$mypip3 install $cwd/../python_packages/pytz-2015.7.tar.gz
# wget https://pypi.python.org/packages/source/m/matplotlib/matplotlib-1.5.0.tar.gz#md5=7952a539418ed77432aa4727409f24cf
$mypip3 install $cwd/../python_packages/matplotlib-1.5.0.tar.gz

# BioExt
# wget https://github.com/veg/BioExt/archive/0.18.0.tar.gz
# mv 0.18.0.tar.gz BioExt-0.18.9.tar.gz
$mypip3 install $cwd/../python_packages/BioExt-0.18.0.tar.gz

# for hivtrace
cd $cwd
if [ ! -f $cwd/hyphy-2.2.6.tar.gz ]
  then
    wget https://github.com/veg/hyphy/archive/2.2.6.tar.gz
    mv 2.2.6.tar.gz hyphy-2.2.6.tar.gz
fi
#cp $cwd/../python_packages/hyphy-2.2.6.tar.gz .
tar -xzvf hyphy-2.2.6.tar.gz
cd hyphy-2.2.6
#export CMAKE_INSTALL_PREFIX=$cwd/bin
$cmake3 ./
make HYPHYMP
mv HYPHYMP $cwd/bin
cd $cwd 
rm -rf hyphy-2.2.6/
$mypip3 install $cwd/../python_packages/fakemp-0.9.1.tar.gz
# wget https://github.com/veg/hyphy-python/archive/0.1.3.tar.gz
# mv 0.1.3.tar.gz hyphy-python-0.1.3.tar.gz
# pip3 install hyphy-python-0.1.3.tar.gz
# hyphy-python can't find hyphy sources, so use a moodified version
$mypip3 install $cwd/../python_packages/hyphy-python-0.1.3era.tar.gz
$mypip3 install $cwd/../python_packages/hppy-0.9.6era2.tar.gz
$mypip3 install $cwd/../python_packages/hivclustering-1.2.3.tar.gz
$mypip3 install $cwd/../python_packages/hivtrace-0.1.4.tar.gz

$mypip3 install $cwd/../python_packages/scikit-learn-0.17.1.tar.gz
$mypip3 install $cwd/../python_packages/pandas-0.18.1.tar.gz
$mypip3 install $cwd/../python_packages/snowflake-0.0.2.tar.gz

# cleanup
sudo rm -rf Support

# now prepare for test test
export PATH=$cwd/bin:$PATH
echo "PATH is: "
echo $PATH

cd $cwd
# make a copy of the test script for later use
echo "#!/bin/bash" > $cwd/../app/ptest_linux.sh
echo "source ../app/setvars.sh" >> $cwd/../app/ptest_linux.sh
echo "source ../app/setpath.sh" >> $cwd/../app/ptest_linux.sh
echo "hivtrace -i $cwd/../STOP_combined_5-21-15_BS-aligned.fasta -a 500 -r HXB2_pol -t .015 -m 500 -g .05" >> $cwd/../app/ptest_linux.sh
chmod +x $cwd/../app/ptest_linux.sh

# and make runHivtrace.sh command file
echo "#!/bin/bash" > $cwd/../app/runHivtrace_linux.sh
echo "fasta_input=\${1}" >> $cwd/../app/runHivtrace_linux.sh
echo "threshold_input=\${2}" >> $cwd/../app/runHivtrace_linux.sh
echo "source setvars.sh" >> $cwd/../app/runHivtrace_linux.sh
echo "source setpath.sh" >> $cwd/../app/runHivtrace_linux.sh
echo "hivtrace -i \${fasta_input} -a 500 -r HXB2_pol -t \${threshold_input} -m 500 -g .05" >> $cwd/../app/runHivtrace_linux.sh
chmod +x $cwd/../app/runHivtrace_linux.sh
# remember to copy the new hivtrace.py in the install directory
# cp hivtrace.py ../linux_python/lib/python3.4/site-packages/hivtrace

# run command here for testing
# run the test here
#hivtrace -i $cwd/../STOP_combined_5-21-15_BS-aligned.fasta -a 500 -r HXB2_pol -t .015 -m 500 -g .05

echo "you may run a test script containing hivtrace via ../app/ptest_linux.sh"
