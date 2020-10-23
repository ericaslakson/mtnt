To create a windows installation executable: 

Note that the packager inno only runs in windows.  So to create a windows setup.exe you'll have to be on a windows box that has cygwin loaded on it.  You may use the cygwin from a previous installation if you like.  The reason cygwin is required is that there are build scripts which are bash shell scripts.  Another thing to be aware of is that the directory pre-built contains hivtrace related executable and python libs.  If you do a normal setup.exe install, this folder is moved (not copied) into the correct spots for it in the mtnt/cygwin32 directory.  Because of this it is harder to generate a setupe.exe from a non-development install.  Besides pre-built/ there are other scripts that are missing from a normal setup.exe user install.

1. first do a cleanup of files that will be re-generated when a development install is done.  This would include the mtnt/cygwin64 directory and all of the files generated in the linux local python build.  On linux or cygwin you may do this via:

$ cd mtnt
$ rm -rf mtnt/cygwin64

Next remove any libs that were built to support linux.  If you are on ubuntu, you may do this:

$ cd linux_python
$ ./prepare_for_release.sh

If you are in cygwin, then you'll have to remove the linux_python (and other) libs one by one via:

$ cd mtnt/linux_python
$ rm -rf bin
$ rm -rf include
$ rm -rf share
$ rm -rf lib
$ rm -rf Support
$ rm -rf ../app/ptest_linux.sh
$ rm -rf hivtrace.log
$ rm -rf ../app/setvars.sh
$ rm -rf ../app/setpath.sh
$ rm -rf ../app/runHivtrace_linux.sh
$ rm -rf Python-3.4.4

2. download and install inno setup from

http://www.jrsoftware.org/isinfo.php

(isetup-5.5.6.exe) non-unicode...

Inno Setup will pack all required installation files into an executable which can be downloaded or copied to a users machine and executed in order to install mtnt.  The installation steps (including the list of included files) are specified in a script file in the mtnt directory with extension *.iss (with filename inno_mtnt.iss).  A bash script creates this script file in the steps below.

3. make any changes to the file 'get_inno_list.sh'.  You many need to do this if you have added files or directories to the list of files that are incorporated into the installation executable.  This script will ask you for the drive letter of the current disk drive.  So for the c drive enter c:

4. generate the iss script by executing (in cygwin)

$ ./make_inno_iss_file.sh

You will have to wait awhile as there are many files.

5. open inno setup and load the script file mtnt\mtnt_inno.iss.  Run (Build | Compile) or debug (Run | Run to cursor) the installation build process.

6 (Build | Compile) Inno Setup will output the installation executable in mtnt/Output/setup.exe.

o this from a command shell window, bring one up and cd to 2 levels above the development folder.  Then execute the following:
7. Get into 7-zip which presents a file explorer like interface.  Position yourself to to one levels above the mtnt fold and 7-Zip the entire development folder to a *.7z with name similar to: mtnt_app_feb_5.7z.  Then upload to the file server.
