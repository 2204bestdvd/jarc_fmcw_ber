var fs = require('fs');
var serial = require('serialport');
var http = require('http').Server();
var random = require('random-js')();
var port = 8080;

var events = require('events');
var eventEmitter = new events.EventEmitter();

http.listen(port, 'localhost', function(){
    console.log('listening on ' + http.address().address + ':' + port);
});


/********
 * Create serial port connection
 ********/
var rxCliPortname = "COM4";
var rxDataPortname = "COM5";
var txCliPortname = "COM10";
var txDataPortname = "COM9";

var rxCliLog = true;
var txCliLog = true;
var rxDataLog = true;
var txDataLog = true;


if (process.argv.length < 6) {
    console.log("Tx data port not specified, use default " + txDataPortname);
    if (process.argv.length < 5) {
        console.log("Tx cli port not specified, use default " + txCliPortname);
        if (process.argv.length < 4) {
            console.log("Rx data port not specified, use default " + rxDataPortname);
            if (process.argv.length < 3) {
                console.log("Rx cli port not specified, use default " + rxCliPortname);
            } else {
                rxCliPortname = process.argv[2];
            }
        } else {
            rxDataPortname = process.argv[3];            
        }
    } else {
        txCliPortname = process.argv[4];
    }
} else {
    txDataPortname = process.argv[5];
}

portParameter1 = {
    baudRate: 115200,
    autoOpen: true,
};

try {
    var rxCli = new serial(rxCliPortname, portParameter1);
    var rxData = new serial(rxDataPortname, portParameter1);

    var txCli = new serial(txCliPortname, portParameter1);
    var txData = new serial(txDataPortname, portParameter1);
} catch(e) {
    console.log(e);
}

const Readline = serial.parsers.Readline;

var parserRxCli = new Readline();
rxCli.pipe(parserRxCli);
rxCli.on("open", function () {
    console.log('open rx cli port');
});
parserRxCli.on('data', function (data) {
    if (rxCliLog) {
        console.log(data);
    }

    if (data.match(/Done/g)) {
        eventEmitter.emit('done', 'rx cli done');
    }
});  

var parserRxData = new Readline();
rxData.pipe(parserRxData);
rxData.on("open", function () {
    console.log('open rx data port');
});
parserRxData.on('data', function (data) {
    if (rxDataLog) {
        console.log(data);
    }
    processRxData(data);
});  


var parserTxCli = new Readline();
txCli.pipe(parserTxCli);

txCli.on("open", function () {
    console.log('open tx cli port');
});
parserTxCli.on('data', function (data) {
    if (txCliLog) {
        console.log(data);
    }

    if (data.match(/Done/g)) {
        eventEmitter.emit('done', 'tx cli done');
    }
});  

var parserTxData = new Readline();
txData.pipe(parserTxData);

txData.on("open", function () {
    console.log('open tx data port');
});
parserTxData.on('data', function (data) {
    if (txDataLog) {
        console.log(data);
    }
    processTxData(data);
});  

 
// Read input from console
var stdin = process.openStdin();
stdin.addListener("data", function(d) {
    //serialPortCli.write(d);
    switch (parseInt(d.toString())) {
        case 1: 
            initLoadCli(rxCfgFilename, rxCli);
            break;
        case 2: 
            initLoadCli(txCfgFilename, txCli);
            break;
        case 3:
            startSendData();
        case 4:
            rxCliLog = !rxCliLog;
            txCliLog = !txCliLog;
            rxDataLog = !rxDataLog;
            txDataLog = !txDataLog;
        default:
            console.log(d);
    }

});




/********
 * Config file handling
 ********/

var cliLoading = 0;
function initLoadCli(filename, port) {
    // Set flag as loading cli cfg
    cliLoading = 1;

    var commandPause = 100;

    port.write('\n');

    var lines;
    fs.readFile(filename, 'utf8', function(err, data) {
        lines = data.split('\n');

        setTimeout(function() { 
            // Automatically select the mode
            port.write('3');
            port.write('\n'); 
    
            var line = 0;
            var sendAndWait = function(){
                if (line < lines.length) {
                    //console.log('message: ' + lines[line]);
                    port.write(lines[line] + '\n');
            
                    line++;
                    setTimeout(sendAndWait, commandPause);                
                }
            }
    
            sendAndWait();
        }, commandPause);
    });
}

/*
var txCfgFilename = 'profiles/ber/profile_ber_test_hw_trigger_slope_1_tx.cfg';
var rxCfgFilename = 'profiles/ber/profile_ber_test_hw_trigger_slope_1_rx.cfg';
*/
var txCfgFilename = 'profiles/transmitter/profile_fft_test_hw_trigger_chirp_128_slope_1_tx.cfg';
var rxCfgFilename = 'profiles/transmitter/profile_fft_test_hw_trigger_chirp_128_slope_1_rx.cfg';




/******
 * Data handling: random data generation, tx, rx
 ******/



var txQueue = [];
var rxQueue = [];
var txSymbolQueue = [0,1,2,3].concat(Array(124).fill(0));  // First frame is preset in the config file
var rxSymbolQueue = [];
var nextTxLocation = 0;
var correctBits = 0;
var wrongBits = 0;

function enqueueHexString(str) { 
    while (str.length >= 2) { 
        txQueue.push(parseInt(str.substring(0, 2), 16));
        str = str.substring(2, str.length);
    }
    //console.log(txQueue);
}

var numLoad = 0
function loadTxQueue() {
    if (txQueue.length > 100000) return;
    console.log('Tx queue length = ' + txQueue.length);        

    var value = random.hex(200000);
    enqueueHexString(value);
    numLoad++;
}

function bitCount (n) {
    var bits = 0
    while (n !== 0) {
      bits += bitCount32(n | 0)
      n /= 0x100000000
    }
    return bits
}
  
function bitCount32 (n) {
    n = n - ((n >> 1) & 0x55555555)
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333)
    return ((n + (n >> 4) & 0xF0F0F0F) * 0x1010101) >> 24
}

function compareByteArray (arr1, arr2) {
    if (arr1.length !== arr2.length) {
        throw new Error('Could not compare arrays of different sizes');
    }
    var correct = 0;
    var error = 0;

    for (var i = 0; i < arr1.length; i++) {
        var diff = bitCount32(arr1[i] ^ arr2[i]);
        error += diff;
        correct += (8 - diff);
    }

    return [correct, error];
}


function processRxQueue() {
    //console.log("Tx: " + txQueue.slice(0, rxQueue.length));
    //console.log("Rx: " + rxQueue);

    if (rxQueue.length == 0) return;

    if (nextTxLocation < rxQueue.length) {
        throw new Error('Receive queue longer than transmit queue');
    }

    console.log("Tx: " + txQueue.slice(0, rxQueue.length));
    console.log("Rx: " + rxQueue);

    try{
        result = compareByteArray(txQueue.slice(0, rxQueue.length), rxQueue);
    } catch(e) {
        console.log(e);
    }
    // Trim the processed data
    console.log('Queue lengths (before): ', txQueue.length, rxQueue.length);
    txQueue = txQueue.slice(rxQueue.length);
    nextTxLocation -= rxQueue.length;
    rxQueue = [];
    console.log('Queue lengths (after): ', txQueue.length, rxQueue.length);

    correctBits += result[0];
    wrongBits += result[1];

    console.log("Correct bits: " + correctBits + ", incorrect bits: " + wrongBits);
}

function compareSymbolArray (arr1, arr2) {
    if (arr1.length !== arr2.length) {
        throw new Error('Could not compare arrays of different sizes');
    }
    var correct = 0;
    var error = 0;

    for (var i = 0; i < arr1.length; i++) {
        var diff = bitCount32(arr1[i] ^ arr2[i]);
        error += diff;
        correct += (2 - diff);
    }

    return [correct, error];
}

function processRxSymbolQueue() {
    if (rxSymbolQueue.length == 0 || txSymbolQueue.length < rxSymbolQueue.length) return;

    console.log("Tx: " + txSymbolQueue.slice(0, rxSymbolQueue.length));
    console.log("Rx: " + rxSymbolQueue);

    try {
        result = compareSymbolArray(txSymbolQueue.slice(0, rxSymbolQueue.length), rxSymbolQueue);
    } catch(e) {
        console.log(e);
    }
    // Trim the processed data
    console.log('Queue lengths (before): ', txSymbolQueue.length, rxSymbolQueue.length);
    txSymbolQueue = txSymbolQueue.slice(rxSymbolQueue.length);
    rxSymbolQueue = [];
    console.log('Queue lengths (after): ', txSymbolQueue.length, rxSymbolQueue.length);

    correctBits += result[0];
    wrongBits += result[1];

    console.log("Correct bits: " + correctBits + ", incorrect bits: " + wrongBits);
}


function receiveByte(byteArray) {
    // Enqueue received bytes
    console.log('Receiving ' + byteArray.length + ' bytes');
    rxQueue = rxQueue.concat(byteArray);
    // Check receive queue against transmit queue
    processRxQueue();
}


const txQueueLoader = setInterval(loadTxQueue, 1000);



/*******
 * Tx device functions
 *******/


var maxNumBytePerCommand = 100;
var doneFlag = 0;
var sendingInProgress = 0;
function trySendData(timeout) {
    return new Promise( function(resolve, reject) {
        var numByte = (txQueue.length > maxNumBytePerCommand)? maxNumBytePerCommand : txQueue.length;
        if (numByte == 0) {
            reject('Data queue empty');
            return;
        }

        var bytes = txQueue.slice(nextTxLocation, nextTxLocation + numByte);
        nextTxLocation += numByte;
        var command = ['hexTx', numByte].concat(toHexString(bytes)).join(' ');
        //socket.emit('command', command);
        txCli.write(command + '\n');

        //socket.on('log', receiveDone);
        eventEmitter.addListener('done', receiveDone);

        setTimeout(function() {
            if (doneFlag === 1) {
                resolve(numByte);
            } else {
                reject('Timeout for receiving done');
            }
            doneFlag = 0;
            //socket.removeListener('log', receiveDone);
            eventEmitter.removeListener('done', receiveDone);
        }, timeout)
    });
}

function toHexString(byteArray) {
    return Array.from(byteArray, function(byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('')
}

function receiveDone(msg){
    /*
    if (msg.match(/Done/g)) {
        doneFlag = 1;
    }
    */
   doneFlag = 1;
}

function sendData() {
    sendingInProgress = 1;
    trySendData(200).then(function(numByte) {
        console.log('Sent ' + numByte + ' bytes');

        // continue sending data until failure or data queue empty
        sendData();
    }).catch(function(err){
        console.log(err);

        // Stop sending
        sendingInProgress = 0;
    })
}

function startSendData() {
    setInterval( function() {
        //if (socket.disconnected) return;

        if (sendingInProgress === 0){
            sendData();
        }
    }, 100);
}

function parseTxSymbolData(data) {
    data = data.split(',').map(Number);
    data.pop();  // remove trailing zero caused by newline character

    txSymbolQueue = txSymbolQueue.concat(data);
    //console.log("Tx symbol queue: " + txSymbolQueue);
}

function processTxData(data) {
    if (data.length > 1 && data[1] === '*') {
        return;
    }

    parseTxSymbolData(data);
}


/*******
 * Rx device functions
 *******/

function parseSymbolData(data) {
    data = data.split(',').map(Number);
    data.pop();  // remove trailing zero caused by newline character

    rxSymbolQueue = rxSymbolQueue.concat(data);
    //console.log("Rx symbol queue: " + rxSymbolQueue);
}

function parseByteData(data) {
    data = data.split(',').map(Number);
    data.pop();  // remove trailing zero caused by newline character

    rxQueue = rxQueue.concat(data);
}

function processRxData(data) {
    if (data.length > 1) {
        if (data[1] === '*') {
            return;
        } else if (data[1] === '#') {
            console.log(data);
            return;
        }

    }

    parseSymbolData(data);
    //parseByteData(data);

    // Check receive queue against transmit queue
    processRxSymbolQueue();
    //processRxQueue();    
}




/*

//setInterval(tx, 1000, 100);


function tx(numByte) {
    // number of bytes should not exceed available bytes in tx queue
    numByte = Math.min(numByte, txQueue.length - nextTxLocation);
    console.log('Sending out ' + numByte + ' bytes');

    // prepare data for tx
    var data = txQueue.slice(nextTxLocation, nextTxLocation + numByte);
    nextTxLocation += numByte;

    // schedule tx
    setTimeout(receiveByte, 100, data);
}


// Error generation
function getRandomByte(probTrue = 0.5) {
    var randomByte = 0;

    for (var i = 0; i < 8; i++) {
        randomByte <<= 1;
        if(random.bool(probTrue)) {
            randomByte++;
        }
    }

    return randomByte;
}


for (var i = 0; i < 10; i++) {
    console.log(getRandomByte(0.1));
}
*/
