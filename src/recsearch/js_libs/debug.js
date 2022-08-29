"use strict";

const DebugTrace  = 0;
const DebugInfo   = 1;
const DebugWarn   = 2;
const DebugOff    = 3;
var   DebugMode   = DebugInfo;

function dbgTrace(s)
{
    var ts = new Date().toISOString();
    if (DebugMode <= DebugTrace)
        console.log (ts+ ":Trace:"+s);
}

function dbgInfo(s, overRide=false)
{
    var ts = new Date().toISOString();  
    if (DebugMode <= DebugInfo || overRide)
        console.log (ts+ ":Info:"+s);
}

function dbgWarn(s, overRide=false)
{
    var ts = new Date().toISOString();
    if (DebugMode <= DebugWarn || overRide)
        console.log (ts+ ":Warn:"+s);
}

function dbgError(s)
{
    var ts = new Date().toISOString();
    console.log (ts+ ":Error:"+s);
}