Ext.define('Rally.technicalservices.CommentDialog',{
    extend: 'Rally.ui.dialog.Dialog',
    alias: 'widget.tscommentdialog',

    height: 400,
    width: 600,
    layout: 'fit',
    closable: true,
    draggable: true,
    
    config: {
        title: 'Timesheet Comments',
        
        keyPrefix: null,
        
        preferences: null,
        
        defaultFocus: 'comment_field'
    },

    constructor: function(config) {
        this.mergeConfig(config);

        if ( Ext.isEmpty(this.config.keyPrefix) ) {
            throw "keyPrefix is required for the Comment Dialog";
        }
        
        if ( !Ext.isArray(this.config.preferences) ) {
            throw "preferences is required for the Comment Dialog";
        }
        
        this.callParent([this.config]);
    },

    initComponent: function() {
        this.callParent(arguments);

        this.addEvents(
            /**
             * @event commentAdded
             * Fires when user posts a new comment
             * @param {Rally.technicalservices.CommentDialog} source the dialog
             * @param {Ext.data.Model} new post comment
             */
            'commentAdded',
            /**
             * @event commentRemoved
             * Fires when user removes a new comment
             * @param {Rally.technicalservices.CommentDialog} source the dialog
             * @param {Ext.data.Model} old post comment
             */
            'commentRemoved'
        );
    },

    beforeRender: function() {
        this.callParent(arguments);
        
       this.addDocked({
            xtype: 'toolbar',
            dock: 'bottom',
            padding: '0 0 10 0',
            layout: {
                type: 'hbox',
                pack: 'center'
            },
            ui: 'footer',
            items: [
                {
                    xtype: 'rallybutton',
                    text: 'Close',
                    cls: 'secondary rly-small',
                    handler: this.close,
                    scope: this,
                    ui: 'link'
                }
            ]
        });
        
        this.addDocked({
            xtype: 'toolbar',
            itemId: 'add_box',
            dock: 'top',
            border: false,
            padding: 2,
            items: this._getAddBoxItems()
        });
        
        this.buildGrid();
    },

    _getColumns: function() {
        var columns = [];
        var can_delete = TSUtilities.currentUserIsAdmin();

        if ( can_delete ) {
            columns.push({
                xtype: 'tscommentrowactioncolumn',
                rowActionsFn: function(record,view) {
                    return [
                        {
                            text: 'Remove', 
                            record: record, 
                            view: view,
                            handler: function(){
                                var item = this.record;
                                var pref = this.record.get('Preference');
                                
                                if ( pref ) {
                                    if ( this.view && this.view.getStore() ) {
                                        this.view.getStore().remove(item);
                                        this.view.getStore().fireEvent('recordRemoved',this.view.getStore(), item);
                                    }
                                    pref.destroy();
                                }
                            }}
                    ]
                }
            });
        }
            
        return Ext.Array.push(columns,[
            {dataIndex: 'User', text:'User'},
            {dataIndex: 'Comment', text:'Comment', flex: 1},
            {dataIndex: 'CreationDate', text: 'Posted', renderer: function(value) { 
                return Ext.util.Format.date(value,'n/j/Y, g:i a')}
            }
        ]);
    },
    
    buildGrid: function() {
        if (this.grid) {
            this.grid.destroy();
        }

        var me = this;

        var data = Ext.Array.map(this.preferences, function(preference){
            var value = Ext.JSON.decode( preference.get("Value") );
            return {
                Comment: value.text,
                User: value.user._refObjectName,
                CreationDate: preference.get('CreationDate'),
                Preference: preference
            };
        });
                
        var store = Ext.create('Rally.data.custom.Store',{
            data: data,
            sorters: [{property:'CreationDate', direction:'DESC'}],
            listeners: {
                scope: this, 
                recordRemoved: function(store, record) {
                    this.fireEvent('commentRemoved', this, record.get('Preference'));
                }
            }
        });
        
        this.grid = Ext.create('Rally.ui.grid.Grid', {
            columnCfgs: this._getColumns(),
            enableEditing: false,
            enableColumnHide: false,
            enableColumnMove: false,
            showRowActionsColumn: false,
            showPagingToolbar: false,
            store: store
        });

        this.add(this.grid);
    },
    
    _getAddBoxItems: function() {
        var can_post = TSUtilities.getEditableProjectForCurrentUser();

        var tooltip_text = "Posting requires Edit rights in at least one project";
        
        if ( can_post !== false && !Ext.isEmpty( can_post )) {
            can_post = true;
            tooltip_text = "Submit Comment";
        }
        
        return [
        {
            xtype: 'rallytextfield',
            itemId: 'comment_field',
            flex: 1,
            margin: 5
        },
        {
            xtype:'rallybutton',
            text: 'Post',
            disabled: !can_post,
            toolTipText: tooltip_text,
            listeners: {
                scope: this,
                click: this._postComment
            }
        }
        ];
    },
    
    _postComment: function() {
        var comment_field = this.down('#comment_field');
        
        var comment = comment_field.getValue();
        if ( Ext.isEmpty(comment) || Ext.isEmpty(Ext.String.trim(comment)) ) {
            return;
        }
        
        comment_field.setValue('');
        
        var current_user = Rally.getApp().getContext().getUser();

        var value = {
            text: comment,
            user: { 
                _type: 'User', 
                '_ref': current_user._ref, 
                '_refObjectName': current_user._refObjectName,
                'ObjectID': current_user.ObjectID
            }
        };
        
        var key = Ext.String.format("{0}.{1}",
            this.keyPrefix,
            Ext.util.Format.date( new Date(), 'time' )
        );
        
        this._makePreference(key,Ext.JSON.encode(value)).then({
            scope: this,
            success: function(results) {
                Ext.Array.push(this.preferences, results);
                this.buildGrid();
            },
            failure: function(msg) {
                Ext.Msg.alert("Cannot Create Comment", msg);
            }
        });
    },
    
    _makePreference: function(key,value) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        Rally.data.ModelFactory.getModel({
            type: 'Preference',
            success: function(model) {

                var pref_config = {
                    Name: key,
                    Value: value,
                    Project: TSUtilities.getEditableProjectForCurrentUser()
                }

                var pref = Ext.create(model, pref_config);
                
                pref.save({
                    callback: function(result, operation) {
                        if(operation.wasSuccessful()) {
                            me.fireEvent('commentAdded',this,result);
                            deferred.resolve([result]);
                        } else {
                            deferred.reject(operation.error.errors[0]);
                        }
                    }
                });
            }
        });
        return deferred.promise;
    }
    
});