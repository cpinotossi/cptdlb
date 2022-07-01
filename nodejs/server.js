#!/usr/bin/env nodejs

const https = require('https');
const http = require('http');
const fs = require('fs');
const url = require('url');
require('dotenv').config();
const logger = require('./logger');


const portHttp = process.env.PORTHTTP;
const color = process.env.SCOLOR;
const iip = process.env.INTERFACEIP;

// Object which will be printed on server response
let socketDetails = {
    ladd:'',
    lport:'',
    radd:'',
    rport:''
};

// Create http server
var server = http.createServer();
server.on('request',(req,res)=>{
    //Create some cpu load
    let f = (url.parse(req.url,true).query.f)?parseInt(url.parse(req.url,true).query.f):0;
    socketDetails.ladd = req.socket.localAddress;
    socketDetails.lport = req.socket.localPort;
    socketDetails.radd = req.socket.remoteAddress;
    socketDetails.rport = req.socket.remotePort;
    //console.log(JSON.stringify(socketDetails, null, '\t'));
    logger.info(socketDetails);
    res.write(`<body bgcolor="${color}">\n`);
    res.write(`in:${f},out:${fibo(f)}\n`);
    res.write(`${JSON.stringify(req.headers, null, '\t')}\n`);
    res.write(`${JSON.stringify(socketDetails, null, '\t')}\n`);   
    res.write(`</body>\n`);
    res.end();
});

server.listen(portHttp,iip,()=>{
    logger.info(`ServerHTTP waiting on ${iip}:${portHttp} for you`);
    //console.log(`ServerHTTP waiting on ${iip}:${portHttp} for you`)
})

function fibo(num){
    if(num<=1){
        return num;
    }else{
        return fibo(num-1)+fibo(num-2);
    }
}
