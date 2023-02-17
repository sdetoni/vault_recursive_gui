"use strict";

function veiOutput (l)
{    
    if (! l) { l = "" };
    $('#textarea_expimp_logout').val($('#textarea_expimp_logout').val() + "\n" + l);
    dbgInfo (l);
}


function  vaultExportImport_JSONFormatActionDialog ()
{    
    // check session
    var token = vaultToken();
    dbgTrace ("token = " + token);
    if (token == null)        
    {
        $("#exportImportJSONDialog").dialog('close');
        noteError ("Please Login before export/import to JSON action can be used.");
        return false;
    }          

    (async () => 
    {   
        var isRoot = await vault_HasRootAccess (VaultAddr, token);
        if (! isRoot)
        {   
            noteError ("Please Login with a ROOT token to use this feature!");
            return;
        }
        
        // Populate input field with current path 
        var rtnVals = vault_pathURLtoNamePath (VaultCurrentURL)
        var p = unescape(rtnVals[0]) + gfLStrip(unescape(rtnVals[1]), FLDRCHR) ;   
        $('#expimpSecretExpPath').val(p);
        
        // clear the output... 
        $('#textarea_expimp_inout').val('');

        $("#exportImportJSONDialog").dialog({
                autoOpen: false,
                width: "auto",
                modal: false,
                title: "Export/Import Secrets from/into JSON format",
                position: {of:       window,
                           my:       'center top',
                           at:       'center top+130',
                           collision:'none'
                          }, 
                close: function () 
                       { 
                           $(this).dialog("close");
                       }
        });        
        
        $("#exportImportJSONDialog").prev(".ui-dialog-titlebar").css("background-color","darkred");
        $("#exportImportJSONDialog").prev(".ui-dialog-titlebar").css("color","white");
        $("#exportImportJSONDialog").prev(".ui-dialog-buttonpane").css("background-color","darkred");        
        $("#exportImportJSONDialog").dialog('open');                  
    })();
}   

async function  vaultExportImport_ExpJSONFormat (d, rtnStr='', depth=0)
{   
    var hdr     = "";
    var dataCnt = 0;
    for (var k in d)
    {
        if (d[k]["child"] != null)
        {                
            rtnStr = await vaultExportImport_ExpJSONFormat (d[k]["child"], rtnStr, depth+1);
        }
        else
        {
            var h = '{\n    "mount" : "' + d[k]["scrtName"] + '",\n    "kv_path" : "' + d[k]["scrtPath"] + '",\n    "data_json" : {\n';
            if ((hdr == "") && (hdr != h))
            {
                if (hdr != "")
                {
                    rtnStr += '}\n}';
                    dataCnt = 0;
                }
                hdr = h
                if (rtnStr != "")
                    rtnStr += ',';
                rtnStr += '';
                rtnStr += hdr;
            }
            
            if (hdr == h)
                dataCnt += 1;

            // export output of leaf-node/actual secret
            var secret = await Cryptoe.decrypt(d[k]["data"]);
            rtnStr += '        ' + (dataCnt > 1 ? ',' : '') + '"' + k + '" : "' +  secret.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"' + '\n';
        
        }
    }
    
    if (hdr != "")
        rtnStr += '    }\n}';
        
    if (depth == 0)
        rtnStr = '[' + rtnStr + ']';
        
    return rtnStr;
}

async function vaultExportInput_EXP_JSON (ppath, outCntrlID)
{    
    // check session
    var token = vaultToken();
    dbgTrace ("token = " + token);
    if (token == null)        
    {
        $("#exportImportJSONDialog").dialog('close');
        noteError ("Please Login before export/import to JSON action can be used.");
        return false;
    }          

    (async () => 
    {    
        // Cleans the pathing and spaces
        var path = gfRStrip(gfLStrip(ppath, ' '), ' ');

        var list       = path.split(FLDRCHR);
        var secretName = list[0] + FLDRCHR;
        var secretPath = gfLStrip(list.splice(1).join(FLDRCHR), FLDRCHR);


        // Determine source version and destination version!
        var secretVer = await vault_SecretsVersion (VaultAddr, token, secretName);

        dbgInfo ("vaultExportInput_EXP_JSON : ver=" + secretVer + " name=" + secretName + " path=" + secretPath);

        VaultAbortSearch = false;        
        var rtnVals = null;
        
        if ((secretName == "") || (secretName == FLDRCHR))
        {            
            rtnVals = await vault_FetchQueryRootMounts (VaultAddr, token, '', '');
   
            // marshal results into an expected array as was expected by vault_FetchQueryKVSecrets()
            if (rtnVals != null)
                rtnVals = ["ignore", rtnVals];    
        }
        else        
            rtnVals = await vault_FetchQueryKVSecrets (VaultAddr, token, secretVer, secretName, secretPath);
        
        if (rtnVals == null)
        {
            dbgError ("vaultExportInput_EXP_JSON : vault_FetchQueryKVSecrets something went wrong!");
            return false;
        }

        if (VaultAbortSearch)
            return false;

        var childItems = rtnVals[1];
       
        
        var jsonOutput = await vaultExportImport_ExpJSONFormat (rtnVals[1])
        
        $(outCntrlID).val(jsonOutput);
    })();
}

function vaultExportInput_Help_JSON ()
{
    // Load the code example template code, and replace it with current parameters
    var code = $.ajax({type: "GET",
                       url: "example_expimp_json_format.html",
                       async: false
                     }).responseText;
   
    $("#codeGenSrcDialog").html (code);
    var h = (window.innerHeight / 100) * 90;
    var w = (window.innerWidth  / 100) * 90;
    var d = $("#codeGenSrcDialog").dialog({ maxHeight: h,
                                            maxWidth:  w,
                                            width:     'auto',
                                            autoOpen:  false,
                                            modal:     false,
                                            show:      'fold',
                                            hide:      'fold',
                                            show: {effect: 'fade', duration: 50},
                                            hide: {effect: 'fade', duration: 50},
                                            position: {of:       window,
                                                       my:       'center top',
                                                       at:       'center top',
                                                       collision:'none'
                                                      }
                                        });



    // hack to insert icons
    d.data( "uiDialog" )._title = function(title)
                                 {
                                     title.html( this.options.title );
                                 };

    var cpyJSONCall = "gfCopyToClipboard($('#codeGenSrcDialog').text()); noteNorm('Example Export/Import JSON Format copied to Clipboard');";
    var icon = '<button style="margin-right:5px;" onclick="' + cpyJSONCall + '; return false;"  type="button" class="ui-button ui-corner-all ui-widget ui-button-icon-only custom-title-button" title="Copy to Clipboard">' +
               '<span class="ui-icon ui-icon-copy"></span><span class="ui-button-icon-space"></span>Copy to Clipboard</button>';

    // syntax colour code output
    PR.prettyPrint();

    // insert icon and title text
    d.dialog('option', 'title', icon + 'Example Export/Import JSON Format');
    d.dialog('open');
}


async function vaultExportInput_write_item  (addr, token, name, path, jsonData)
{
    // write data here ...
    var writeURL  = addr;
    var writePath = path;    
    writeURL = writeURL + '/v1/' + gfURLEncode(name + 'data/' + writePath);

    var secretJSON = '{"data":' + JSON.stringify(jsonData) + '}';
    var writeSuccess = await fetch(writeURL, {
            method: 'POST',
            headers: { "x-vault-token" : token },
            cache: 'no-cache',
            body: secretJSON
        })
        .then(data => {
             if (data.status == 200)
             {
                veiOutput('vaultExportInput_write_item: Success:' + name + writePath);
                return true;
             }
             dbgError  ("vaultExportInput_write_item: Return status code != 200, got " + data.status);
             dbgError  ("vaultExportInput_write_item: Error failed request on " + writeURL);
             var e = "Bad Vault Response: Failed Vault Import for: " + name + writePath;
             veiOutput (e);
             noteError (e);
             return false;
        })
        .catch((error) => {
                dbgError  ("vaultExportInput_write_item: Error failed request on " + writeURL);
                dbgError  ("vaultExportInput_write_item: " + error);
                var e = "Exception: Failed Vault Import for: " + name + writePath;
                veiOutput (e); 
                noteError (e);
                return false;
       });
}


async function vaultExportInput_IMP_JSON (ppath, outCntrlID)
{    
    // check session
    var token = vaultToken();
    dbgTrace ("token = " + token);
    if (token == null)        
    {
        $("#exportImportJSONDialog").dialog('close');
        noteError ("Please Login before export/import to JSON action can be used.");
        return false;
    }          

    (async () => 
    { 
        var str = $('#textarea_expimp_inout').val().trim();
        if (str == "")        
            return;
        
        var jObj = null;
        try 
        {
            jObj = JSON.parse(str);
        }
        catch (error) 
        {
            noteError ("JSON Import data failed format parsing!");
        }
        
        if (jObj == null)
            return;
        
        if (! confirm('Confirm import/replace secrets into Vault?'))
            return;
            
        veiOutput ("-------------------------------------------------------------------");
        
        if (Array.isArray(jObj))
        {
            for (var idx = 0; idx < jObj.length; idx++)
            {
                veiOutput ("Importing item " + (idx+1));
                try                 
                {
                    await vaultExportInput_write_item  (VaultAddr, token, jObj[idx]["mount"], jObj[idx]["kv_path"], jObj[idx]["data_json"]);
                }
                catch (error) 
                {
                    veiOutput ("ERROR Importing item " + (idx+1));
                    veiOutput ("ERROR " + str(error));
                }
            }
        }
        else // Import single item ... 
        {
            await vaultExportInput_write_item  (VaultAddr, token, jObj["mount"], jObj["kv_path"], jObj["data_json"]);
        }   
    })();
}
