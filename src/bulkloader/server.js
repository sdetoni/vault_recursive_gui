"use strict";
// Written by Steven De Toni Feb 2022
// ----------------------------------
// This service is used in conjuction with project vault_recursive_search, 
// and allows to quick bulk loading of Vault secrets associated within a token/user's login.

const fetch        = require('node-fetch');
const https        = require('https');
const fs           = require('fs');
const url          = require('url');
const os           = require("os");

const SERVER_PORT             = 16180;
var   VaultAddr               = "";
const FLDRCHR                 = '/';       // char used to separate a vault secrets path (e.g. systems/SMS-Keepass-Database/LoadBalancer)
const VaultCacheMaxAgeMinutes = 4*60;      // 4 hour before auto expire of cache objects, and auto cache loading (if enabled) becomes active
var   certsOptions = null;

// debugging, point to local certs if running locally
certsOptions = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};
    
// dont cache anything!    
function noCache (res)
{
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Expires', '-1');
    res.setHeader('Pragma', 'no-cache');
}

// ===========================================================================================

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

// ===========================================================================================

var gf_crc_a_table = "00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D";
var gf_crc_b_table = gf_crc_a_table.split(' ').map(function(s){ return parseInt(s,16) });
function gfCRC32 (str, hexOutput=false) {
    var crc = -1;
    for(var i=0, iTop=str.length; i<iTop; i++) {
        crc = ( crc >>> 8 ) ^ gf_crc_b_table[( crc ^ str.charCodeAt( i ) ) & 0xFF];
    }

    var v = (crc ^ (-1)) >>> 0;
    if (hexOutput)
        return v.toString(16).toUpperCase();
    return v;
};

function gfURLEncode (url)
{
    var tempArray        = decodeURIComponent(url).split("?");
    var baseURL          = tempArray[0];

    var baseParts        = baseURL.split("://")
    var basePath         = null;

    if (baseParts.length > 1)
        basePath = baseParts[1];
    else
        basePath = baseParts[0];

    var pathParts = basePath.split('/');
    var newPath   = ''
    for (var idx = 0; idx < basePath.length; idx++ )
    {
        if (basePath[idx].indexOf('/') >= 0)
            newPath += basePath[idx];
        else
            newPath += encodeURIComponent(basePath[idx]);
    }

    var newURL = '';
    if (baseParts.length > 1)
        newURL = baseParts[0] + '://';

    newURL += newPath;

    if (tempArray.length > 1)
        newURL += '?' + encodeURI(tempArray[1]);

    return newURL;
}

//Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function replaceAll(str, match, replacement){
   return str.replace(new RegExp(escapeRegExp(match), 'g'), ()=>replacement);
}

function gfEscapeRegExp(string)
{
    return replaceAll(string, /([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function gfRStrip (s1, s2)
{
    var re = new RegExp(gfEscapeRegExp(s2)+"$", "g");
    while (s1.match(re))
        s1 = s1.replace(re, "");
    return s1;
}

function gfLStrip (s1, s2)
{
    var re = new RegExp("^"+gfEscapeRegExp(s2), "g");
    while (s1.match(re))
        s1 = s1.replace(re, "");
    return s1;
}

// mock placeholder fuction 
class gfCryptStdCrypto 
{   
    async init (rndSize = 16, bitSize = 128) 
    {
    }
   
    async encrypt(data) 
    {
        return data;
    }
    
    async decrypt(data) 
    {
        return data;
    }
}

// ===========================================================================================

function vaultDumpDict (d, depth=0)
{
    for (var k in d)
    {
        if (typeof(d[k]) == "object")
        {
            dbgInfo ((Array(depth).fill('    ').join('')) + k);
            vaultDumpDict (d[k], depth+1);
        }
        else
            dbgInfo ((Array(depth).fill('    ').join('')) + k + ':' + d[k]);
    }
}

function vaultIsFolderPath (path)
{
    return path.endsWith(FLDRCHR);
}

// mock placeholder fuctions
function updateReqCacheIconStatus () { }
function gfRefreshIFramePage () { }
function noteError (msg, showTime=3500) { }

// ------------------------------------------------------------------------------------------------

function ProcessNodeJSLoadRequest (req, res)
{
    var Cryptoe          = new gfCryptStdCrypto(); Cryptoe.init(16,64);
    var VaultAbortSearch = false;     // Cancel current search operation
    var VaultAPICache    = { };
    var VaultAPIPending  = { };
    
// ==== copy/replace these functions without alterations from project: vault_recursive_search ====
// ======================================= Start of vaultbulkloader Insert =========================================

function submitVaultAPIRequest (token, url, clrCacheOnError=false, vaultAPIPendingDict=null)
{
    let uobj = {clrCacheOnError:clrCacheOnError, promise:null};

    if (vaultAPIPendingDict)
        vaultAPIPendingDict[url] = uobj;
    else
        VaultAPIPending[url] = uobj;

    // start async loading of url
    // dbgTrace ("submitVaultAPIRequest submit : " + url);
    uobj.promise = fetch(url, { method: 'GET'
                               , headers: { "x-vault-token" : token,
                                            "Connection"    : "keep-alive"
                                          }
                               , cache: 'no-cache'
                        })
                        .then(response => response.json())
                        .then(data => {
                            // dbgTrace ("submitVaultAPIRequest: adding VaultAPICache " + url);
                            addReqCache (url, data, vaultAPIPendingDict);
                            return true;
                        })
                        .catch((error) => {
                                if (uobj.clrCacheOnError)
                                    clrReqCache();
                                dbgError  ("submitVaultAPIRequest: Error failed request on " + url);
                                dbgError  ("submitVaultAPIRequest: " + error);
                                removeVaultAPIRequest(url, vaultAPIPendingDict);
                                return false;
                        });
}

async function waitAllVaultAPIRequest ()
{
    while (Object.keys(VaultAPICache).length > 0)
    {
        await new Promise(s => setTimeout(s, 1));
    }
}

function removeVaultAPIRequest (url, vaultAPIPendingDict=null)
{
    if (vaultAPIPendingDict)
        delete vaultAPIPendingDict[url];
    else
        delete VaultAPIPending[url];
}

async function getReqCache (url)
{
    return await (async () =>
    {
        const interrupt = 1;
        const timeOut   = (1000/interrupt)*30;
        var  urlWaited = false;
        var  urlLoaded = false;

        if (url.match("^http.*"))
        {
            // Wait time for current URL to complete and be loaded into cache! max time approx 30 seconds if the 16ms timer is honoured
            for (var i = 0; i < timeOut; i++)
            {
                let uobj = VaultAPIPending[url];
                if (! uobj)
                {
                    if (urlWaited)
                        urlLoaded = true;
                    // dbgTrace ("getReqCache: ubj null  " + url);
                    break;
                }

                // if attached promise, then block/wait until its completed...
                if (uobj.promise)
                {
                    urlWaited = true;
                    // dbgTrace ("getReqCache: waiting for " + url);
                    await uobj.promise;
                }

                // release cpu in this thread of execution to allow item to be removed from VaultAPIPending, and placed into VaultAPICache
                await new Promise(s => setTimeout(s, interrupt));
            }

            if (i >= timeOut)
                dbgError ("getReqCache: timeOut on '" + url + "'");
        }

        let fnd = (url in VaultAPICache)
        if (urlWaited && urlLoaded && !fnd)
        {
            dbgError ("======================================================");
            dbgError ("=== URL was loaded, but not in VaultAPICache [ASYNC Loading ERROR!, review addReqCache() in function submitVaultAPIRequest()]");
            dbgError ("=== URL: " + url);
            dbgError ("======================================================");
        }

        // structure of item { json: <json data>; timestamp: <last updated> }
        if (fnd)
        {
            if (!urlWaited && !urlLoaded)
            {
                // test if cache entry is old ...
                var millis = Date.now() - VaultAPICache[url]["timestamp"];
                if ((Math.floor(millis/1000)/60) > VaultCacheMaxAgeMinutes)
                {
                    // dbgInfo ("getReqCache: expired " + url);
                    delete VaultAPICache[url];
                    return [false, null];
                }
            }

            var data =  await Cryptoe.decrypt(VaultAPICache[url]["json"]);
            // if (url.match("^http.*"))
            //     dbgInfo ("getReqCache: data loaded " + url);
            return [true, data];
        }

        return [false, null];
    })();
}

async function addReqCache (url, data, vaultAPIPendingDict=null)
{
    var add2Cache = false;

    // dont store json data that is in error as this can lead to incorrect results
    if ((typeof data === "object") && !("errors" in data))
        add2Cache = true;
    else if ((data != null) && (data != ""))
        add2Cache = true;

    if (add2Cache)
    {
        new Promise(function(resolve, reject)
        {
            resolve(Cryptoe.encrypt(data));
        }).then (encyptedData => {
            VaultAPICache[url] = { "json":encyptedData, timestamp:Date.now() };

            // dbgInfo ("submitVaultAPIRequest: removing VaultAPIPending " + url);
            removeVaultAPIRequest(url, vaultAPIPendingDict);
        });
    }
}

var LastCacheStatus             = ""
function clrReqCache ()
{    
    if (VaultAPICache && (Object.keys(VaultAPICache).length > 0))
    {
        VaultAPICache = {};
        Cryptoe.init(16,64); // re-new the encryption key...
        
        if ((LastCacheStatus != "") && (LastCacheStatus != "cache-status-empty"))
        {
            dbgInfo ("clrReqCache: cache cleared! " + LastCacheStatus);
            LastCacheStatus = "";
            updateReqCacheIconStatus ();
        }
    }
}

// ################################################################################################

// matchFolderType bit values:
// 0  = match all data
// 1  = match non-leaf and leaf container folder
// 2  = match non-leaf container folder
async function vault_FetchQueryKVSecrets  (addr, token, version, name, path='', regMatch='', prnMatches=false, matchFolderType=0, notRegMatchPath='', recurse=true, ignoreVaultAbortSearch=false)
{
    return await (async () =>
    {
        // dbgTrace ("Reading: '" + name + path + "'")

        var cmpRegMatch        = new RegExp(regMatch, 'ig');
        var cmpNotRegMatchPath = new RegExp(notRegMatchPath, 'ig');
        var listURL            = addr;
        var rtnData            = { };

        // vault kv list <name>
        // list keys call
        if (version == '1')
            listURL = listURL + '/v1/' + gfURLEncode(name + path) + '?list=true'
        else if (version == '2')
            listURL = listURL + '/v1/' + gfURLEncode(name + 'metadata/' + path) + '?list=true';
        else
            return (null);

        // print (listURL)
        // dbgTrace ("Calling URL: " + listURL)
        var fldrDataOrig = null;

        if (vaultIsFolderPath(name+path))
        {
            var cache = await getReqCache (listURL);
            if (cache[0])
                fldrDataOrig = cache[1];
            else
            {
                submitVaultAPIRequest (token, listURL, true);
                cache = await getReqCache (listURL);
                if (cache[0])
                    fldrDataOrig = cache[1];
                else
                {
                    dbgError ("####### vault_FetchQueryKVSecrets : NULL Return 1! Exiting Loaded " + Object.keys(VaultAPICache).length +  ", pending " + Object.keys(VaultAPIPending).length + " urls! " + listURL);
                    return null;
                }
            }
        }

        // vault kv get <name>/<key>
        var fldrDataKeys = { };

        if ((! fldrDataOrig) || ("errors" in fldrDataOrig))
        {
            dbgWarn ("vault_FetchQueryKVSecrets: list folder data is NULL! :  " + listURL);
            dbgWarn ("vault_FetchQueryKVSecrets: converting request to query KV item");

            if (path == '')
                return ([listURL, rtnData]);

            // convert failed list query to KV item query
            var p = gfRStrip(path, FLDRCHR);
            var k = p.split(FLDRCHR).pop();
            path = gfRStrip(p, k);
            fldrDataKeys = {0:  k};
        }
        else
        {
            //dbgTrace("== Dumping vault_FetchQueryKVSecrets '" + name + "/" + path + "' ==");
            //vaultDumpDict (fldrDataOrig);
            //dbgTrace("========================================");

            if ( ['1', '2'].includes(version))
                fldrDataKeys = fldrDataOrig['data']['keys'];
        }

        // Place url requests into pending load url list
        for (var i in fldrDataKeys)
        {
            var k = fldrDataKeys[i];

            // if using notRegMatchPath, then test if path matches, and continue/ignore
            if ((notRegMatchPath != '') && (k.match(cmpNotRegMatchPath)))
                 continue;

            if (k.match("\/$"))
                continue;

            var keyURL = '';
            if (version == '1')
            {
                keyURL = addr + '/v1/' + gfURLEncode(name + path + k);
                var cache = await getReqCache (keyURL);
                if (! cache[0])
                    submitVaultAPIRequest (token, keyURL, false);
            }
            else if (version == '2')
            {
                keyURL = addr + '/v1/' + gfURLEncode(name + 'data/' + path + k);
                var cache = await getReqCache (keyURL);
                if (! cache[0])
                    submitVaultAPIRequest (token, keyURL, false);
            }
        }

        // try and preload any folders recursively so they are in a pending state and  can be loaded concurrently...
        for (var i in fldrDataKeys)
        {
            if ((VaultAbortSearch) && (! ignoreVaultAbortSearch))
            {
                dbgError ("####### vault_FetchQueryKVSecrets : ABORTED 1! Exiting Loaded " + Object.keys(VaultAPICache).length +  ", pending " + Object.keys(VaultAPIPending).length + " urls!");
                return null;
            }

            var k = fldrDataKeys[i];

            // if using notRegMatchPath, then test if path matches, and continue/ignore
            if ((notRegMatchPath != '') && (k.match(cmpNotRegMatchPath)))
                 continue;

            // if folder type, process this first and load pending requests...
            if (k.match("\/$") && recurse)
            {
                var ks = gfRStrip(k, FLDRCHR);
                var rtnVals = await vault_FetchQueryKVSecrets (addr, token, version, name, path + k, regMatch, prnMatches, matchFolderType, notRegMatchPath, recurse, ignoreVaultAbortSearch);
                if (rtnVals == null)
                {
                    dbgError ("####### vault_FetchQueryKVSecrets : NULL Return 2! Exiting Loaded " + Object.keys(VaultAPICache).length +  ", pending " + Object.keys(VaultAPIPending).length + " urls! " + path + k);
                    return (null);
                }
                rtnData[k] = { apiURL: rtnVals[0],
                                scrtVersion: version,
                                scrtName: name,
                                scrtPath: path + k,
                                isLeafNode: false,
                                isEndFolder:false,
                                data: null,
                                child: rtnVals[1]
                              };
            }
        }

        // match and scran results from hopefully, now cached results.
        for (var i in fldrDataKeys)
        {
            if ((VaultAbortSearch) && (! ignoreVaultAbortSearch))
            {
                dbgError ("####### vault_FetchQueryKVSecrets : ABORTED 2! Exiting Loaded " + Object.keys(VaultAPICache).length +  ", pending " + Object.keys(VaultAPIPending).length + " urls!");
                return null;
            }

            var k = fldrDataKeys[i];

            // if using notRegMatchPath, then test if path matches, and continue/ignore
            if ((notRegMatchPath != '') && (k.match(cmpNotRegMatchPath)))
                 continue;

            if (k.match("\/$") && recurse)
            {
               // already processed in previous loop
            }
            // matchFolderType:
            // 0  = match all data
            // 1  = match non-leaf and leaf container folder
            // 2  = match non-leaf container folder
            else if (matchFolderType < 2)
            {
                var keyURL = '';
                var leafData = null;
                if (version == '1')
                {
                    try
                    {                    
                        keyURL = addr + '/v1/' + gfURLEncode(name + path + k);
                        var leafNode = null;
                        var cache = await getReqCache (keyURL);
                        if (cache[0])
                            leafNode = cache[1];
                        else
                        {
                            dbgError ("####### vault_FetchQueryKVSecrets : NULL Return 3! Exiting Loaded " + Object.keys(VaultAPICache).length +  ", pending " + Object.keys(VaultAPIPending).length + " urls! " + keyURL);
                            return (null);
                        }

                        if ((! leafNode) || ("errors" in leafNode))
                        {
                            dbgError ("vault_FetchQueryKVSecrets: leafNode(1) is NULL!");
                            continue; // return ([listURL, rtnData]);
                        }
                        leafData = leafNode['data']
                    }
                    catch (error)
                    {
                        dbgInfo ("MATCH ERROR matchFolderType[1]: " + error.message);
                        leafData = null;
                    }
                }
                else if (version == '2')
                {
                    try
                    { 
                        keyURL = addr + '/v1/' + gfURLEncode (name + 'data/' + path + k);
                        var leafNode = null;
                        var cache = await getReqCache (keyURL);
                        if (cache[0])
                            leafNode = cache[1];
                        else
                        {
                            dbgError ("####### vault_FetchQueryKVSecrets : NULL Return 4! Exiting Loaded " + Object.keys(VaultAPICache).length +  ", pending " + Object.keys(VaultAPIPending).length + " urls! " + keyURL);
                            return (null);
                        }

                        if ((! leafNode) || ("errors" in leafNode))
                        {
                            dbgError ("vault_FetchQueryKVSecrets: leafNode(2) is NULL! '" + keyURL + "'");
                            continue; // return ([listURL, rtnData]);
                        }
                        leafData = leafNode['data']['data']
                    }
                    catch (error)
                    {
                        dbgInfo ("MATCH ERROR matchFolderType[2]: " + error.message);
                        leafData = null;
                    }
                }

                if (! leafData)
                {
                    dbgWarn ("vault_FetchQueryKVSecrets: leafData is NULL!");
                    // continue;
                }

                rtnData[k] = { child:{},
                               apiURL:keyURL,
                               scrtVersion: version,
                               scrtName: name,
                               scrtPath: path + k,
                               isLeafNode: false,
                               isEndFolder:true,
                               data:await Cryptoe.encrypt(leafData)
                             };
                var matched = false;

                try
                {
                    // if using regExpr matching, then load ALL of leaf node data
                    if ((regMatch != '') && (k.match(cmpRegMatch)))
                         matched = true;

                    // If matching against something ...
                    if ((regMatch != '') && (matched == false))
                    {
                        for (var lk in leafData)
                        {
                            if (typeof(leafData[lk]) == "object")
                                matched = ( lk.match(cmpRegMatch) || JSON.stringify(leafData[lk]).match(cmpRegMatch) ) ? true : false;
                            else
                                matched = ( lk.match(cmpRegMatch) || leafData[lk].match(cmpRegMatch) ) ? true : false;

                            if (matched)
                            {
                                if (prnMatches)
                                    dbgInfo ("vault_FetchQueryKVSecrets: Matched: " + name + path + k + ' :: ' + lk + ":" + leafData[lk]);
                                break;
                            }
                        }
                    }
                    else
                    {
                        matched = true;
                    }
                }
                catch (error)
                {
                    dbgInfo ("MATCH ERROR: " + error.message);
                    noteError ("Unhandled exception on matching with regular expression:<br>'" + regMatch + "'<br>" + error.message);
                    return null;
                }

                // matchFolderType:
                // 0  = match all data
                // 1  = match non-leaf and leaf container folder
                // 2  = match non-leaf container folder
                if (matchFolderType < 1)
                {
                    // If any match found, then add all of leaf data nodes to the list...
                    if (matched)
                    {
                        for (var lk in leafData)
                        {
                            // dbgTrace ("Storing: '" + name + path + k + '/' + lk + "'");
                            rtnData[k]["child"][lk] = { child:null,
                                                        apiURL:keyURL,
                                                        scrtVersion: version,
                                                        scrtName: name,
                                                        scrtPath: path + k,
                                                        isLeafNode: true,
                                                        isEndFolder:false,
                                                        data:await Cryptoe.encrypt(leafData[lk]),
                                                        id:gfCRC32(name + path + k, true) };
                        }
                    }
                }
            }

            let kobj = rtnData[k];
            // if using regExpr matching, and nothing is matched on this sub-key, then ignore its results
            if (kobj && (regMatch != '') && ((Object.keys(kobj["child"]).length <= 0) && (! k.match(cmpRegMatch))))
                delete rtnData[k];
        }

        return ([listURL, rtnData]);
   })();
}

// matchFolderType:
// 0  = match all data
// 1  = match non-leaf and leaf container folder
// 2  = match non-leaf container folder
async function vault_FetchQueryRootMounts (addr, token, name, path, regMatch='', matchFolderType=0, notRegMatchPath='',ignoreVaultAbortSearch=false)
{
    return await (async () =>
    {
        // Activate the search cache
        if (token != null)
            await addReqCache ("token", token);
        else
        {
            dbgError ("vault_FetchQueryRootMounts: token is NULL!");
            return null;
        }

        var cmpRegMatch = new RegExp(regMatch, 'ig');
        var listURL     = addr + '/v1/sys/internal/ui/mounts';
        var jsonData    = null;
        var cache       = await getReqCache (listURL);
        if (cache[0])
            jsonData = cache[1];
        else
        {
            submitVaultAPIRequest (token, listURL, true);
            cache = await getReqCache (listURL);
            if (cache[0])
                jsonData = cache[1];
            else
                return null;
        }

        if (! jsonData)
        {
            dbgError ("vault_FetchQueryRootMounts: jsonData is NULL!");
            return null;
        }

        // vaultDumpDict (jsonData);

        if ("errors" in jsonData)
        {
            clrReqCache();
            dbgError  ("vault_FetchQueryRootMounts: Failed query on " + listURL );
            dbgError  ("vault_FetchQueryRootMounts: " + jsonData["errors"]);
            noteError ("Failed Vault Request.<br>Please try re-authentication or check Vault service.<br>"+jsonData["errors"]);

            // can't continue these types of operations if it cannot event query root mounts!
            if (jsonData["errors"][0].match('denied'))
                 gfRefreshIFramePage ();

            return null;
        }

        // Make sure name has a trailing '/' for comparisons from json data
        if (name != '')
            name = gfRStrip(name, FLDRCHR) + FLDRCHR;

        var rtnData = { };
        var secrets=jsonData['data']['secret'];
        for (var key in secrets)
        {
            if ((VaultAbortSearch) && (! ignoreVaultAbortSearch))
            {
                dbgError ("####### vault_FetchQueryRootMounts : ABORTED! Exiting Loaded " + Object.keys(VaultAPICache).length +  ", pending " + Object.keys(VaultAPIPending).length + " urls!");
                return null;
            }

            // dbgTrace (key + '::' + JSON.stringify(secrets[key]));
            // var rsKey = gfRStrip(key, FLDRCHR);

            // if name is not null, and does not  matches mount point key, continue
            if ((name != '') && (name != key))
                continue;

            if (secrets[key]['type'] == 'kv')
            {

                var rtnVals = await vault_FetchQueryKVSecrets (addr, token, secrets[key]['options']['version'], key, path, regMatch, false, matchFolderType, notRegMatchPath, true, ignoreVaultAbortSearch);
                if (rtnVals == null)
                {
                    dbgError ("####### vault_FetchQueryRootMounts : NULL Return 1! Exiting Loaded " + Object.keys(VaultAPICache).length +  ", pending " + Object.keys(VaultAPIPending).length + " urls!");
                    return null;
                }
                rtnData[key] = { apiURL: rtnVals[0],
                                   scrtVersion: secrets[key]['options']['version'],
                                   scrtName: key,
                                   scrtPath: path,
                                   isLeafNode: false,
                                   isEndFolder:false,
                                   data: null,
                                   child: rtnVals[1]
                                 };
            }
            else if (secrets[key]['type'] == 'cubbyhole')
            {
                var rtnVals = await vault_FetchQueryKVSecrets (addr, token, '1', key, path, regMatch, false, matchFolderType, notRegMatchPath, true, ignoreVaultAbortSearch);
                if (rtnVals == null)
                {
                    dbgInfo ("####### vault_FetchQueryRootMounts : NULL Return 2! Exiting Loaded " + Object.keys(VaultAPICache).length +  ", pending " + Object.keys(VaultAPIPending).length + " urls!");
                    return null;
                }
                rtnData[key] = { apiURL: rtnVals[0],
                                   scrtVersion: '1',
                                   scrtName: key,
                                   scrtPath: path,
                                   isLeafNode: false,
                                   isEndFolder:false,
                                   data:null,
                                   child: rtnVals[1]
                                 };
            }
            else
                continue;

            // remove blank matches
            if ((regMatch != '') && ((Object.keys(rtnData[key]["child"]).length <= 0) && (! key.match(cmpRegMatch))))
                delete rtnData[key];
        }

        dbgTrace ("####### vault_FetchQueryRootMounts : Exiting Loaded " + Object.keys(VaultAPICache).length +  ", pending " + Object.keys(VaultAPIPending).length + " urls!");
        return rtnData;
   })();
}

// ======================================= End of vaultbulkloader Insert =========================================

    // actual process nodejs http(s) request:
    var url_parts = url.parse(req.url);
    var token     = null;
    var proxyHost = null;
    var baseName  = "";
    var basePath  = "";

    // console.log(url_parts);
    // console.log(url_parts.pathname);
    const queryObject = url.parse(req.url, true).query;
    try { token     = queryObject.token;     } catch (error) { token = null; }
    try { proxyHost = queryObject.proxyhost; } catch (error) { proxyHost = null; }
    if (! token)
    {
        try { token= req.headers['x-vault-token'];  } catch (error) { token = null; }
    }

    if (! token)
    {
        dbgInfo ("Bad Request: " + req.url);
        noCache (res);        
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end('Bad Request!');
        return;
    }

    dbgTrace (req.url);
    dbgTrace ("Token = " + token);

    (async () =>
    {
        dbgInfo ("Starting Bulk Load...");
        let startTimeStamp = new Date();
        var rtnData        = await vault_FetchQueryRootMounts (VaultAddr, token, '', '', '');
        let endTimeStamp   = new Date();
        let elapsedSeconds = (endTimeStamp.getTime() - startTimeStamp.getTime()) / 1000;
        dbgInfo ("Completed VaultAPICache in " + elapsedSeconds + " seconds, loaded " + Object.keys(VaultAPICache).length + " urls!");
                    
        if ((rtnData != null) && (Object.keys(rtnData).length > 0))
        {
            // vaultDumpDict (rtnData);

            // update the return data to match the proxy host being used...
            if (proxyHost)
            {
                dbgInfo ("proxyhost parameter set as '"+ proxyHost + "'");
                let newVaultAPICache  = { }; 
                let counter = 0;
                const getRtnHost = /^(http|https)(\:\/\/)(.*?)(\/.*)/gm;
                for (var key in VaultAPICache) 
                {
                    // check key/url matches this hosts server, otherwise change it to match reverse proxy
                    if (getRtnHost.exec(key))
                    {
                        // update source host name to proxy host name
                        let newKey = key.replace(getRtnHost, "$1$2" + proxyHost +"$4");
                        newVaultAPICache[newKey] = VaultAPICache[key];
                        counter++;
                    }
                    else
                        newVaultAPICache[key] = VaultAPICache[key];
                }
                VaultAPICache = newVaultAPICache;
                dbgInfo ("proxyhost updated " + counter + " times into newVaultAPICache out of " + Object.keys(newVaultAPICache).length + " possible keys");
            }

            noCache (res);
            res.writeHead(200, {'Content-Type': 'application/json'});
            
            // res.end(JSON.stringify(rtnData));
            res.end(JSON.stringify(VaultAPICache));
        }
        else
        {
            noCache (res);            
            res.writeHead(400, {'Content-Type': 'text/plain'});
            res.end('Error!');
        }
    })();
}
// ################################################################################################

dbgInfo ("Starting Vault Bulk Loader Server using port " + SERVER_PORT);    
https.createServer(certsOptions, function (req, res){

    VaultAddr = "https://" + req.headers['host'].split(':')[0];

    // console.log(JSON.stringify(req.headers));    
    // dbgInfo ("OS Hostname   : " + os.hostname());    
    dbgInfo ("x-forwarded-for:"  + req.headers['x-forwarded-for'] + ", Host:" + req.headers['host'].split(':')[0] + ", VaultAddr:" + VaultAddr );
    dbgInfo ("req url: " + req.url.split('?')[0]);    
    
    if (req.url.match("^\/vaultbulkcacheloader"))
        ProcessNodeJSLoadRequest (req, res);
    else if (req.url.match("^\/status"))
    {
        noCache (res);            
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('OK!');                
    }
    else
    {
        noCache (res);            
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end('Error!');        
    } 
}).listen(SERVER_PORT);
