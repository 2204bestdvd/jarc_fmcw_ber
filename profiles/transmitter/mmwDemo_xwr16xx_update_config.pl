#This script updates the mmwave profile configuration files
#for the mmwave demo. Valid only for xwr16xx scripts.
#syntax: perl mmwDemo_xwr16xx_update_config.pl <your_cfg_file> 
#output file: <your_cfg_file>_updated

die "syntax: $0   <Input cfg file> \n" if ($#ARGV != 0);
$inputFile = $ARGV[0]; 
$scriptName = $0;
open INPUT, $inputFile or die "Can't open $inputFile\n";
$outputFile = ">" . $inputFile . "_updated";
open OUTPUT, $outputFile or die "\nCan't create file to update config: " . $outputFile."\n";

$scriptVersion = "1.0";

#fields to be updated
@fieldsUpdated = 
(
 "adcbufCfg",
 "guiMonitor",
 "cfarCfg",
 "peakGrouping",
 "multiObjBeamForming",
 "clutterRemoval",
 "calibDcRangeSig",
 "extendedMaxVelocity"
);

#number of expected entries for each field
%numEntries = (
 adcbufCfg  => 5,
 guiMonitor => 7, 
 cfarCfg => 8,
 peakGrouping => 6,
 multiObjBeamForming => 3, 
 clutterRemoval => 2,
 calibDcRangeSig => 5,
 extendedMaxVelocity => 2
);

#warning banner
$warningBanner = "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n";

#Comment to be added when a new command is inserted in the script
$newCmdMsg = "\%Inserting new mandatory command. Check users guide for details.\n";

#String appended to the begining of the command
$update_string = " -1";

#Updating the config file to work with visualizer given by the version below
# visualizerVersion = v1.v2.v3
$v1 = 1;
$v2 = 1;
$v3 = 0;
$visualizerVersion = $v1.".".$v2.".".$v3;

#first run through the file to check for missing commands introduced in the latest release
$extendedMaxVelocityFlag = 0;
$clutterRemovalFlag = 0;
$calibDcRangeSigFlag = 0;
$compRangeBiasAndRxChanPhaseFlag = 0;
$measureRangeBiasAndRxChanPhaseFlag = 0;
$missingCmdFlag = 0;
$lineCount = 0;
while (<INPUT>) 
{
    $lineCount++;
    $i = $_;
    if (index($i,"extendedMaxVelocity")>=0 ) 
    {
       $extendedMaxVelocityFlag = 1;
       next;       
    }
    if (index($i,"clutterRemoval")>=0 ) 
    {
       $clutterRemovalFlag = 1;
       next;       
    }
    if (index($i,"calibDcRangeSig")>=0 ) 
    {
       $calibDcRangeSigFlag = 1;
       next;       
    }
    if (index($i,"compRangeBiasAndRxChanPhase")>=0 ) 
    {
       $compRangeBiasAndRxChanPhaseFlag = 1;
       next;       
    }    
    if (index($i,"measureRangeBiasAndRxChanPhase")>=0 ) 
    {
       $measureRangeBiasAndRxChanPhaseFlag = 1;
       next;       
    }    
    if (index($i,"sensorStart")>=0)
    {
        $sensorStartLine = $lineCount;
    }
}

$warningMsg = $warningBanner."The following mandatory command(s) was(were) added to the output script. Check the users guide for details.\n";
if($extendedMaxVelocityFlag == 0)
{
    $missingCmdFlag = 1;
    $warningMsg = $warningMsg."Command: extendedMaxVelocity\n";
}
if($clutterRemovalFlag == 0)
{
    $missingCmdFlag = 1;
    $warningMsg = $warningMsg."Command: clutterRemoval\n";
}
if($calibDcRangeSigFlag == 0)
{
    $missingCmdFlag = 1;
    $warningMsg = $warningMsg."Command: calibDcRangeSig\n";
}
if($compRangeBiasAndRxChanPhaseFlag == 0)
{
    $missingCmdFlag = 1;
    $warningMsg = $warningMsg."Command: compRangeBiasAndRxChanPhase\n";
}
if($measureRangeBiasAndRxChanPhaseFlag == 0)
{
    $missingCmdFlag = 1;
    $warningMsg = $warningMsg."Command: measureRangeBiasAndRxChanPhase\n";
}
$warningMsg = $warningMsg.$warningBanner;

seek INPUT, 0, 0;

#create output file
print OUTPUT "\%This file was updated by script ",$scriptName," version:",$scriptVersion,"\n";
print OUTPUT "\%This file is compatible with Visualizer Version:",$visualizerVersion,"\n";
$lineCount = 0;
while (<INPUT>) 
{
    #print "$_\n";
    $lineCount++;
    if($lineCount == $sensorStartLine)
    {
        #Lets place here the missing commands, just before sensorStart cmd
        if($extendedMaxVelocityFlag == 0)
        {
            print OUTPUT $newCmdMsg . "extendedMaxVelocity -1 0\n";
        }
        if($clutterRemovalFlag == 0)
        {
            print OUTPUT $newCmdMsg . "clutterRemoval -1 0\n";
        }
        if($calibDcRangeSigFlag == 0)
        {
            print OUTPUT $newCmdMsg . "calibDcRangeSig -1 0 -5 8 256\n";
        }
        if($compRangeBiasAndRxChanPhaseFlag == 0)
        {
            print OUTPUT $newCmdMsg . "compRangeBiasAndRxChanPhase 0.0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0\n";
        }
        if($measureRangeBiasAndRxChanPhaseFlag == 0)
        {
            print OUTPUT $newCmdMsg . "measureRangeBiasAndRxChanPhase 0 1.5 0.2\n";
        }
    }
    $i = $_;
    $match = 0;
    foreach $f (@fieldsUpdated)
    {
        if (index($i,$f)>=0 ) 
        {
            @s = split(/ /, $i);
            #Check if this command already has the expected number of entries.
            #In this case, do not update this line.
            if(scalar(@s) != ($numEntries{$f} + 1))
            {
                $newLine = $s[0].$update_string;
                for($k=1; $k<scalar(@s); $k++)
                {
                    $newLine = $newLine . " " . $s[$k];   
                }
                print OUTPUT $newLine;
                $match = 1;
            }    
            last;
        }
    }
    if($match == 0)
    {
        # no match with version or with replacement lines. Just copy line to output.
        print OUTPUT $i;        
    }
}
close (INPUT);
close (OUTPUT);
if($missingCmdFlag == 1)
{
    die $warningMsg;
}

