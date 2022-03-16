Ext.define('Rally.technicalservices.CommentButton',{
    extend: 'Rally.ui.Button',
    requires: [
        'TSUtilities',
        'TSDateUtils',
        'Rally.technicalservices.CommentDialog'
    ],
    
    alias: 'widget.tscommentbutton',
    
    config: {
        keyPrefix: null
    },
    
    constructor:function (config) {
        this.mergeConfig(config);
        if ( Ext.isEmpty(this.config.keyPrefix) ) {
            throw "keyPrefix is required for the Comment Button";
        }

        this.config.text = Ext.String.format("<span class='icon-comment'>{0}</span>", config.text || "");
        
        this.callParent([this.config]);
    },
    
    afterRender: function() {
        this.callParent(arguments);

        this.setDisabled(true);
        
        this._getComments().then({
            scope: this,
            success: function(results) {
                this.comments = results;
                this._setResultCount();
                
                this.mon(this.el, this.clickEvent, this._showDialog, this);
                this.setDisabled(false);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading comments', msg);
            }
        });
    },
    
    _setResultCount: function() {
        var count = this.comments.length;
        var text = "";
        if ( count === 0 ) {
            text = Ext.String.format("<span class='icon-comment'>{0}</span>", "");
        } else {
            text = Ext.String.format("<span class='icon-comment'></span> {0}", count);
        }
        this.setText(text);
    },
    
    _getComments: function() {
        var key = this.keyPrefix;
        
        var config = {
            model:'Preference',
            filters: [{property:'Name',operator:'contains', value:key}],
            fetch: ['Name','Value','CreationDate']
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _showDialog: function() {
        Ext.create('Rally.technicalservices.CommentDialog',{
            autoShow: true,
            keyPrefix: this.keyPrefix,
            preferences: this.comments,
            listeners: {
                scope: this,
                commentAdded: function(dialog,comment) {
                    this.comments = Ext.Array.merge(this.comments,comment);
                    this._setResultCount();
                },
                commentRemoved: function(dialog, comment) {
                    this.comments = Ext.Array.remove(this.comments,comment);
                    this._setResultCount();
                }
            }
        });
    }
});