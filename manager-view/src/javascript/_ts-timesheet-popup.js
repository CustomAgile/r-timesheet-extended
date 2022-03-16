Ext.define('Rally.technicalservices.ManagerDetailDialog', {
    extend: 'Rally.ui.dialog.Dialog',
    autoShow : true,
    closable : true,
    layout   : 'border',
    
    config: {
        record: null,
        commentKeyPrefix: '',
        manager_field: null
    },

    constructor: function(config) {
        this.mergeConfig(config);

        this.callParent([this.config]);
        
        this.task_fetch_fields = ['ObjectID','Name','FormattedID','WorkProduct','Project', TSCommonSettings.getLowestPortfolioItemTypeName(), 'State', 'Iteration', 'Estimate'];
        this.defect_fetch_fields = ['ObjectID','Name','FormattedID','Requirement','Project', TSCommonSettings.getLowestPortfolioItemTypeName(), 'State', 'Iteration', 'Estimate'];
        this.story_fetch_fields = ['WorkProduct', TSCommonSettings.getLowestPortfolioItemTypeName(), 'Project', 'ObjectID', 'Name', 'Release', 'PlanEstimate', 'ScheduleState'];

    },

    initComponent: function() {
        this.callParent(arguments);
    },
        
    beforeRender: function() {
        this.callParent(arguments);
        
        this._loadWeekLockPreference().then({
            scope: this,
            success: function(week_lock_prefs) {
                
                if ( week_lock_prefs.length > 0 ) {
                    var value = week_lock_prefs[0].get('Value');
                    var status_object = Ext.JSON.decode(value);
                    var locked = false;
                    
                    if ( status_object.status == "Locked" ) {
                        locked = true;
                    }
                }
                this.record.set('__Locked',locked);
                
                this.add({
                    xtype:  'tstimetable',
                    region: 'center',
                    layout: 'fit',
                    localWeekStartDate: this.record.get('WeekStartDate'),
                    week_locked: locked,
                    editable: false,
                    manager_field: this.manager_field,
                    timesheet_user: this.record.get('User')
                });
                this.addDocked({
                    xtype: 'container',
                    dock: 'bottom',
                    layout: 'hbox',
                    itemId: 'popup_selector_box',
                    padding: 10,
                    items: [
                        {xtype:'container', itemId:'popup_left_box'},
                        {xtype:'container',  flex: 1},
                        {xtype:'container', itemId:'popup_right_box'}
                    ]
                });
                
                this._addSelectors();
                
            }, 
            failure: function(msg) {
                Ext.Msg.alert('Problem finding lock', msg);
            }
        });
    },
    
    _addSelectors: function() {
        var status = this.record.get('__Status');
        var locked = this.record.get('__Locked');
         
        var comment_key = Ext.String.format("{0}.{1}.{2}", 
            this.commentKeyPrefix,
            TSDateUtils.formatShiftedDate(this.record.get('WeekStartDate'),'Y-m-d'),
            this.record.get('User').ObjectID
        );
        
        var left_box = this.down('#popup_left_box');
        
        if ( TSCommonSettings.isManagerEditAllowed() ) {
            left_box.add({
                xtype:'rallybutton',
                text: '+<span class="icon-task"> </span>',
                disabled: (status == TSTimesheet.STATUS.APPROVED || locked),
                toolTipText: "Search and add Tasks",
                listeners: {
                    scope: this,
                    click: this._findAndAddTask
                }
            });
            
            left_box.add({
                xtype:'rallybutton',
                text: '+<span class="icon-defect"> </span>',
                disabled: (status == TSTimesheet.STATUS.APPROVED || locked),
                toolTipText: "Search and add Defects",
                listeners: {
                    scope: this,
                    click: this._findAndAddDefect
                }
            });
            
            left_box.add({
                xtype:'rallybutton',
                text: '+<span class="icon-story"> </span>',
                toolTipText: "Search and add User Stories",
                disabled: (status == TSTimesheet.STATUS.APPROVED || locked),
                listeners: {
                    scope: this,
                    click: this._findAndAddStory
                }
            });
        }
        
        left_box.add({
            xtype:'tscommentbutton',
            toolTipText: 'Read/Add Comments',
            keyPrefix: comment_key
        });

        this.down('#popup_right_box').add({
            xtype:'rallybutton', 
            text:'Unapprove',
            disabled: (status != TSTimesheet.STATUS.APPROVED || locked),
            listeners: {
                scope: this,
                click: function() {
                    this._unapproveTimesheet(this.record);
                    this.close();
                }
            }
        });
        
        this.down('#popup_right_box').add({
            xtype:'rallybutton', 
            text:'Approve',
            disabled: (status != TSTimesheet.STATUS.SUBMITTED),
            listeners: {
                scope: this,
                click: function() {
                    this._approveTimesheet(this.record);
                    this.close();
                }
            }
        });
        
        this.down('#popup_right_box').add({
            xtype:'rallybutton',
            itemId:'export_button',
            cls: 'secondary',
            text: '<span class="icon-export"> </span>',
            listeners: {
                scope: this,
                click: function() {
                    this._export();
                }
            }
        });
        
    },
    
    _loadWeekLockPreference: function() {
        
        var key = Ext.String.format("{0}.{1}", 
            TSUtilities.timeLockKeyPrefix,
            TSDateUtils.formatShiftedDate(this.record.get('WeekStartDate'),'Y-m-d')
        );
        
        var filters = [
            {property:'Name',operator:'contains', value:key},
            {property:'Name',operator:'!contains',value:TSUtilities.archiveSuffix }
        ];
        
        var config = {
            model:'Preference',
            limit: 1,
            pageSize: 1,
            filters: filters,
            fetch: ['Name','Value'],
            sorters: [{property:'CreationDate',direction:'DESC'}]
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _approveTimesheet: function(record) {
        record.approve();
    },
    
    _unapproveTimesheet: function(record) {
        record.unapprove();
    },
    
    _findAndAddTask: function() {
        var timetable = this.down('tstimetable');
        
        var fetch_fields = Ext.Array.merge(
            Rally.technicalservices.TimeModelBuilder.getFetchFields(),
            this.task_fetch_fields
        );
        
        if (timetable) {
            Ext.create('Rally.technicalservices.ChooserDialog', {
                artifactTypes: ['task'],
                autoShow: true,
                multiple: true,
                title: 'Choose Task(s)',
                filterableFields: [
                    {
                        displayName: 'Formatted ID',
                        attributeName: 'FormattedID'
                    },
                    {
                        displayName: 'Name',
                        attributeName: 'Name'
                    },
                    {
                        displayName:'WorkProduct',
                        attributeName: 'WorkProduct.Name'
                    },
                    {
                        displayName:'Release',
                        attributeName: 'Release.Name'
                    },
                    {
                        displayName:'Project',
                        attributeName: 'Project.Name'
                    },
                    {
                        displayName:'Owner',
                        attributeName: 'Owner'
                    },
                    {
                        displayName: 'State',
                        attributeName: 'State'
                    }
                ],
                columns: [
                    {
                        text: 'ID',
                        dataIndex: 'FormattedID'
                    },
                    'Name',
                    'WorkProduct',
                    'Release',
                    'Project',
                    'Owner',
                    'State'
                ],
                storeConfig: {
                    filters: [{property:'Release.' + Rally.technicalservices.TimeModelBuilder.deploy_field, operator: '!=', value: true }]
                },
                fetchFields: fetch_fields,
                listeners: {
                    artifactchosen: function(dialog, selectedRecords){
                        if ( !Ext.isArray(selectedRecords) ) {
                            selectedRecords = [selectedRecords];
                        }
                        
                        Ext.Array.each(selectedRecords, function(selectedRecord){
                            timetable.addRowForItem(selectedRecord);
                        });
                    },
                    scope: this
                }
             });
        }
    },
    
    _findAndAddDefect: function() {
        var timetable = this.down('tstimetable');
        
        var fetch_fields = Ext.Array.merge(
            Rally.technicalservices.TimeModelBuilder.getFetchFields(),
            this.defect_fetch_fields
        );
        
        if (timetable) {
            Ext.create('Rally.technicalservices.ChooserDialog', {
                artifactTypes: ['defect'],
                autoShow: true,
                multiple: true,
                title: 'Choose Defect(s)',
                filterableFields: [
                    {
                        displayName: 'Formatted ID',
                        attributeName: 'FormattedID'
                    },
                    {
                        displayName: 'Name',
                        attributeName: 'Name'
                    },
                    {
                        displayName:'Requirement',
                        attributeName: 'Requirement.Name'
                    },
                    {
                        displayName:'Release',
                        attributeName: 'Release.Name'
                    },
                    {
                        displayName:'Project',
                        attributeName: 'Project.Name'
                    },
                    {
                        displayName:'Owner',
                        attributeName: 'Owner'
                    },
                    {
                        displayName: 'State',
                        attributeName: 'State'
                    }
                ],
                columns: [
                    {
                        text: 'ID',
                        dataIndex: 'FormattedID'
                    },
                    'Name',
                    'Requirement',
                    'Release',
                    'Project',
                    'Owner',
                    'State'
                ],
                storeConfig: {
                    filters: [{property:'Release.' + Rally.technicalservices.TimeModelBuilder.deploy_field, operator: '!=', value: true }]
                },
                fetchFields: fetch_fields,
                listeners: {
                    artifactchosen: function(dialog, selectedRecords){
                        if ( !Ext.isArray(selectedRecords) ) {
                            selectedRecords = [selectedRecords];
                        }
                        
                        Ext.Array.each(selectedRecords, function(selectedRecord){
                            timetable.addRowForItem(selectedRecord);
                        });
                    },
                    scope: this
                }
             });
        }
    },
    
    _findAndAddStory: function() {
        var timetable = this.down('tstimetable');
        if (timetable) {
            Ext.create('Rally.technicalservices.ChooserDialog', {
                artifactTypes: ['hierarchicalrequirement'],
                autoShow: true,
                title: 'Choose Story(ies)',
                multiple: true,
                filterableFields: [
                    {
                        displayName: 'Formatted ID',
                        attributeName: 'FormattedID'
                    },
                    {
                        displayName: 'Name',
                        attributeName: 'Name'
                    },
                    {
                        displayName: TSCommonSettings.getLowestPortfolioItemTypeName(),
                        attributeName: TSCommonSettings.getLowestPortfolioItemTypeName() + '.Name'
                    },
                    {
                        displayName:'Release',
                        attributeName: 'Release.Name'
                    },
                    {
                        displayName:'Project',
                        attributeName: 'Project.Name'
                    },
                    {
                        displayName:'Owner',
                        attributeName: 'Owner'
                    },
                    {
                        displayName:'State',
                        attributeName: 'ScheduleState'
                    }
                ],
                columns: [
                    {
                        text: 'ID',
                        dataIndex: 'FormattedID'
                    },
                    'Name',
                    'WorkProduct',
                    'Release',
                    'Project',
                    'Owner',
                    'ScheduleState'
                ],
        
                fetchFields: Ext.Array.merge(
                    Rally.technicalservices.TimeModelBuilder.getFetchFields(),
                    this.story_fetch_fields
                ),
                listeners: {
                    artifactchosen: function(dialog, selectedRecords){
                        if ( !Ext.isArray(selectedRecords) ) {
                            selectedRecords = [selectedRecords];
                        }
                        
                        Ext.Array.each(selectedRecords, function(selectedRecord){
                            timetable.addRowForItem(selectedRecord);
                        });
                    },
                    scope: this
                }
             });
        }
    },
    
    _export: function(){
        var grid = this.down('tstimetable').getGrid();
        var me = this;
        
        if ( !grid ) { return; }
        
        var filename = Ext.String.format('manager-detail-report.csv');

        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function() { return Rally.technicalservices.FileUtilities.getCSVFromGrid(this,grid) } 
        ]).then({
            scope: this,
            success: function(csv){
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() { me.setLoading(false); });
    }
    
});