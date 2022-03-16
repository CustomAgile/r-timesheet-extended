Ext.define("TSTimeSheetAudit", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    //defaults: { margin: 10 },
    items: [
        {
            xtype: 'tabpanel',
            id   : 'tabPanel',
            region: 'center',
            diabled: true,
            border: false,
            tabBar: {
                //height: 28,
                itemId: 'tabBar',
                items: [{
                    xtype: 'container',
                    flex : 1
                }]
            },
            defaults: {
                //border : false,
                layout : 'fit'
            },
            items: [{
                xtype: 'tsapprovalhistorytab',
                title: 'Approvals'
            },{
                xtype: 'tslockhistorytab',
                title: 'Locks'
            },{
                xtype: 'tsfielddeftab',
                disabled: false,
                title: 'Capitalization Field'
            },{
                xtype: 'tsdeploymentfieldhistorytab',
                disabled: false,
                title: 'Deployment Field'
            }],
            listeners: {
                scope: this,
                tabchange: function() {
                    var app = Rally.getApp();
                    var start_date = app.down('#from_date_selector').getValue();
                    var end_date   = app.down('#to_date_selector').getValue();
        
                    if ( start_date && end_date ) {
                        if ( app.down('#go_button') && app.down('#go_button').isDisabled() ) {
                            app._updateData();
                        }
                    }
                }
            }
        }
    ],
        
    launch: function() {
        this._addSelectors();
    },
    
    _addSelectors: function() {
        var container = this.down('#tabBar');
        
        container.add({
            xtype:'rallydatefield',
            itemId:'from_date_selector',
            fieldLabel: 'From',
            labelWidth: 40,
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    this._enableGoButton();
                }
            }
        });
        
        container.add({
            xtype:'rallydatefield',
            itemId:'to_date_selector',
            fieldLabel: 'Through',
            labelWidth: 55,
            margin: '0 0 0 10',
            
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    this._enableGoButton();
                }
            }
        });
        
        container.add({
            xtype:'rallybutton',
            itemId: 'go_button',
            text:'Go',
            margin: '0 3 0 3',
            disabled: true,
            listeners: {
                scope: this,
                click: this._updateData
            }
        });
        
        container.add({type:'container', html: '&nbsp;&nbsp;&nbsp;', border: 0});
    },
    
    _enableGoButton: function() {
        var start_date = null;
        var end_date = null;
        
        start_date = this.down('#from_date_selector').getValue();
        end_date   = this.down('#to_date_selector').getValue();
        
        var button = this.down('#go_button');
        
        if ( button ) {
            button.setDisabled(true);
            if ( start_date && end_date ) {
                button.setDisabled(false);
            }
        }
    },
    
    _updateData: function() {
        
        this.start_date = TSDateUtils.formatShiftedDate(this.down('#from_date_selector').getValue(),'Y-m-d') + 'T00:00:00.000Z';
        this.end_date = TSDateUtils.formatShiftedDate(this.down('#to_date_selector').getValue(),'Y-m-d') + 'T00:00:00.000Z';

        this.down('#go_button').setDisabled(true);
        
        var tabPanel  = Ext.getCmp('tabPanel');
        var activeTab = tabPanel.getActiveTab();
        activeTab.updateContent(this);
    },
//    getOptions: function() {
//        return [
//            {
//                text: 'About...',
//                handler: this._launchInfo,
//                scope: this
//            }
//        ];
//    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){

        // Ext.apply(this, settings);
        this.launch();
    }
});
