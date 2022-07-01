#!/usr/bin/env nodejs

const http = require('http');
const url = require('url');
require('dotenv').config();
const logger = require('./logger');

const portHttp = process.env.PORTHTTP;
const color = process.env.SCOLOR;
const iip = process.env.INTERFACEIP;

// Object which will be printed on server response
let details = {
    ladd:'',
    lport:'',
    radd:'',
    rport:'',
    color:''
};

// Create http server
var server = http.createServer();
server.on('request',(req,res)=>{
    //Create some cpu load
    let f = (url.parse(req.url,true).query.f)?parseInt(url.parse(req.url,true).query.f):0;
    details.ladd = req.socket.localAddress;
    details.lport = req.socket.localPort;
    details.radd = req.socket.remoteAddress;
    details.rport = req.socket.remotePort;
    details.color = color;

    logger.info(details);
    res.write(`<body bgcolor="${color}">\n`);
    res.write(`in:${f},out:${fibo(f)}\n`);
    res.write(`${JSON.stringify(req.headers, null, '\t')}\n`);
    res.write(`${JSON.stringify(details, null, '\t')}\n`);   
    res.write(`</body>\n`);
    res.end();
});

server.listen(portHttp,iip,()=>{
    logger.info(`ServerHTTP waiting on ${iip}:${portHttp} for you`);
})

function fibo(num){
    if(num<=1){
        return num;
    }else{
        return fibo(num-1)+fibo(num-2);
    }
}
