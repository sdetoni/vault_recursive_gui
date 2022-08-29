(function($) 
{
    $.widget( "custom.combobox", 
    {      
        options: { validateData: false },    
        
        _create: function() 
        {
            this.wrapper = $("<span>").addClass("custom-combobox").insertAfter(this.element);
            this.element.hide();
            this._createAutocomplete();
            this._createShowAllButton();
        }, 
        
        _createAutocomplete: function() 
        {
            var selected = this.element.children( ":selected" );
            var value    = selected.val() ? selected.text() : ""; 
            this.input = $("<input>");
            this.input.appendTo(this.wrapper);
            this.input.val(value);
            this.input.attr( "title", "" );
            this.input.attr("placeholder", this.element.attr('placeholder'));
            this.input.attr("id", this.element.attr('id') + '_comboboxinput');
            this.input.addClass( "custom-combobox-input ui-widget ui-widget-content ui-state-default ui-corner-left" );
            this.input.autocomplete({ delay: 0,
                                      minLength: 0,
                                      source: $.proxy( this, "_source" )
                                   });
            this.input.tooltip({ classes: { "ui-tooltip": "ui-state-highlight" } }); 
            this._on( this.input, { autocompleteselect: function( event, ui ) 
                                                        {
                                                            ui.item.option.selected = true;
                                                            this._trigger( "select", event, { item: ui.item.option });
                                                        },
                                    autocompletechange: "_removeIfInvalid"
                                  });
        },
 
        _createShowAllButton: function() 
        {
            var input   = this.input;
            var wasOpen = false;
 
            input.data("ui-autocomplete")._renderItem = function(ul, item) 
            {
                return  $("<li>").append('<div><span>' + item.label +  '</span>' + item.html + '<div>').appendTo(ul);
            };
            
            var a = $("<a>");
            a.attr( "tabIndex", -1 );
            a.attr( "title", "Show All Items" );
            a.tooltip();
            a.appendTo( this.wrapper );
            a.button({ icons: { primary: "ui-icon-triangle-1-s" },
                       text:  false
                    });
            a.removeClass( "ui-corner-all" );
            a.addClass( "custom-combobox-toggle ui-corner-right" );
            a.on( "mousedown", function() 
                               {
                                   wasOpen = input.autocomplete( "widget" ).is( ":visible" );
                               });
            a.on( "click", function() 
                           {
                               input.trigger( "focus" );
                               // Close if already visible
                               if (wasOpen)
                                   return; 
 
                               // Pass empty string as value to search for, displaying all results
                               input.autocomplete( "search", "" );
                           });
        },
           
        _source: function( request, response ) 
        {
            var matcher = new RegExp( $.ui.autocomplete.escapeRegex(request.term), "i" );
            var lo = this.element.children("option");
            var rl = [];           
            for (let idx = 0; idx < lo.length; idx++)
            {
                var t = lo[idx].text;                                           
                var h = lo[idx].getAttribute("cust_html"); // implement custom html render/action code here ... 
                if (lo[idx].value && ( !request.term || matcher.test(t) ) )
                {
                    rl.push({label: t,
                             html:  h ? atob(h) : '',
                             value: t,
                             option: lo[idx]
                           });
                }                  
            }
          
            response(rl)
        },
 
        _removeIfInvalid: function( event, ui ) 
        {
            if (this.options.validateData)
            {
                // Selected an item, nothing to do
                if ( ui.item ) 
                    return;           
     
                // Search for a match (case-insensitive)
                var value          = this.input.val();
                var valueLowerCase = value.toLowerCase();
                var valid          = false;
                
                this.element.children( "option" ).each(function() 
                {
                    if ($(this).text().toLowerCase() === valueLowerCase) 
                    {
                        this.selected = valid = true;
                        return false;
                    }
                });
     
                // Found a match, nothing to do
                if ( valid ) 
                    return;           
             
                // Remove invalid value if validateData is set
                this.input.val("");
                this.input.attr("title", value + " didn't match any item");
                this.input.tooltip("open");
                this.element.val("");
                this._delay(function() 
                {
                    this.input.tooltip("close").attr("title", "");
                }, 2500);
                this.input.autocomplete("instance").term = "";
            }
            else
            {
                this.selected = valid = true;
                return false;
            }
        },
       
        _destroy: function() 
        {
            this.wrapper.remove();
            this.element.show();
        }
    });
})(jQuery);
    