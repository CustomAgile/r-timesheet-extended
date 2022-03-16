/* global Ext TSUtilities */
Ext.define("TSExtendedTimesheet", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 5 },

    layout: { type: 'border' },
    
    items: [{
        xtype:'container',
        itemId:'selector_box',
        region: 'north',
        layout: {
            type:'hbox',
        },
        minHeight: 20,
        items: [
            {
                xtype:'container',
                itemId: 'button_box'
            }, 
             // Padding to allow the following to be right justified
            {
                xtype:'container',
                flex: 1
            },
            {
                xtype:'rallydatefield',
                itemId:'date_selector',
                fieldLabel: 'Week Starting',
            },
            {
                xtype:'container',
                itemId:'status_box',
                padding: '0 10 0 10'
            },
            {
                xtype: 'container',
                itemId: 'statusControls'
            },
            /*
            {
                type:'container',
                html: '&nbsp;&nbsp;&nbsp;',
                border: 0,
                padding: 10
            }
            */
        //}
            
        ]
    }],

    integrationHeaders : {
        name : "TSExtendedTimesheet"
    },
    
    config: {
        defaultSettings: {
            preferenceProjectRef: '/project/51712374295'
        }
    },
   
    _commentKeyPrefix: 'rally.technicalservices.timesheet.comment',
    
    task_fetch_fields: undefined,   // Set in launch once we know the name of the lowest level PI type
    defect_fetch_fields: undefined,   // Set in launch once we know the name of the lowest level PI type
    story_fetch_fields: undefined,  // Set in launch once we know the name of the lowest level PI type

    launch: function() {
        TSDateUtils.getDaysOfWeek();
        var preference_project_ref = this.getSetting('preferenceProjectRef');
        
        TSCommonSettings.initLowestPortfolioItemTypeName().then({
            scope: this,
            success: function() {
                this.task_fetch_fields = ['ObjectID','Name','FormattedID','WorkProduct','Project', TSCommonSettings.getLowestPortfolioItemTypeName(), 'State', 'Iteration', 'Estimate'];
                this.defect_fetch_fields = ['ObjectID','Name','FormattedID','Requirement','Project', TSCommonSettings.getLowestPortfolioItemTypeName(), 'State', 'Iteration', 'Estimate'];
                this.story_fetch_fields = ['WorkProduct', TSCommonSettings.getLowestPortfolioItemTypeName(), 'Project', 'ObjectID', 'Name', 'Release', 'PlanEstimate', 'ScheduleState'];
                return this._absorbOldApprovedTimesheets();
            },
            failure: function() {
                Ext.Msg.alert("Failed to load Portfolio Item Type Names");
            }
        }).then({
            scope: this,
            success: function() {
                this.setLoading(false);
                if ( !  TSUtilities.isEditableProjectForCurrentUser(preference_project_ref,this) ) {
                    Ext.Msg.alert('Contact your Administrator', 'This app requires editor access to the preference project.');
                } else {
                    this._addEventListeners();
                }
            },
            failure: function(msg) {
                Ext.Msg.alert("Problem Reviewing Past Timesheets", msg);
            }
        });
    },
    
    _addEventListeners: function(container) {
        var dateSelector = this.down('#date_selector');
        dateSelector.on('change', this._onDateSelectorChange, this);
        dateSelector.setValue(new Date());
    },
    
    _onDateSelectorChange: function(cmp, newValue) {
        var weekStart = TSDateUtils.getBeginningOfWeekForLocalDate(newValue);
        if ( Ext.Date.isEqual(weekStart, newValue) ) {
            // Selected date is now aligned with week start
            this.localWeekStartDate = newValue;
            this.updateData();
        } else {
            cmp.setValue(weekStart);    // This will fire another change event
        }
    },
    
    _addButtons: function(container) {
        container.removeAll();
        
        container.add({
            xtype:'rallybutton',
            text: 'Add My Tasks',
            toolTipText: "(in current iteration or set as default)", 
            padding: 2,
            disabled: true,
            listeners: {
                scope: this,
                click: this._addCurrentTasks
            }
        });
        
        container.add({
            xtype:'rallybutton',
            text: '+<span class="icon-task"> </span>',
            disabled: true,
            toolTipText: "Search and add Tasks", 
            listeners: {
                scope: this,
                click: this._findAndAddTask
            }
        });
        
        container.add({
            xtype:'rallybutton',
            text: '+<span class="icon-defect"> </span>',
            disabled: true,
            toolTipText: "Search and add Defects", 
            listeners: {
                scope: this,
                click: this._findAndAddDefect
            }
        });
        
        container.add({
            xtype:'rallybutton',
            text: '+<span class="icon-story"> </span>',
            toolTipText: "Search and add User Stories",
            disabled: true,
            listeners: {
                scope: this,
                click: this._findAndAddStory
            }
        });
        
        this._addCommentButton(container);
        
        var timetable = this.down('tstimetable');
        
        if ( !Ext.isEmpty(timetable) ) {
            container.add({
                xtype:'tscolumnpickerbutton',
                margin: '0px 5px 0px 5px',
                padding: '1px 6px 2px 6px',
                cls: 'secondary big',
                columns: timetable.getColumns(),
                listeners: {
                    scope: this,
                    columnsChosen: function(button,columns) {
                        var grid = timetable.getGrid();
                        var store = grid.getStore();
                        
                        grid.reconfigure(store, columns);
                        
                        this.fireEvent('columnsChosen', columns);
                    }
                }
            });
        }
        
    },
    
    _addCommentButton: function(container) {
        var comment_key = Ext.String.format("{0}.{1}.{2}", 
            this._commentKeyPrefix,
            TSDateUtils.getUtcIsoForLocalDate(this.localWeekStartDate),
            this.getContext().getUser().ObjectID
        );
        
        container.add({
            xtype:'tscommentbutton',
            toolTipText: 'Read/Add Comments',
            keyPrefix: comment_key
        });
    },
    
    _addStatusControls: function(statusValue) {
        var container = this.down('#statusControls');
        container.removeAll();
        
        switch(statusValue) {
            case TSTimesheet.STATUS.NOT_SUBMITTED:
                container.add({
                    xtype: 'rallybutton',
                    text: 'Submit',
                    listeners: {
                        scope: this,
                        click: function() {
                            var statusPref = Ext.create('TSTimesheet', {
                                User: this.getContext().getUser(),
                                WeekStartDate: this.localWeekStartDate
                            });
                            statusPref.submit().then({
                                scope: this,
                                success: this.updateData
                            });
                        }
                    }
                });
                break;
            case TSTimesheet.STATUS.SUBMITTED:
                container.add({
                    xtype: 'rallybutton',
                    text: 'Unsubmit',
                    listeners: {
                        scope: this,
                        click: function() {
                            var statusPref = Ext.create('TSTimesheet', {
                                User: this.getContext().getUser(),
                                WeekStartDate: this.localWeekStartDate
                            });
                            statusPref.unsubmit().then({
                                scope: this,
                                success: this.updateData
                            });
                        }
                    }
                });
                break;
            default:
                break;
        }
    },
    
    updateData: function()  { 
        var me = this;
        
        this._disableButtons();
                                
        var timetable  = this.down('tstimetable');
        var button_box = this.down('#button_box');
        var status_box = this.down('#status_box');
        
        if ( !Ext.isEmpty(timetable) ) {
            timetable.destroy();
        }
        
        button_box.removeAll();
        status_box.removeAll();
        
        Deft.Chain.sequence([
            this._loadWeekStatusPreference,
            this._loadWeekLockPreference
        ],this).then({
            scope: this,
            success: function(results) {
                var statusValue = TSTimesheet.STATUS.NOT_SUBMITTED;
                var status_prefs = results[0];
                var week_lock_prefs = results[1];
                
                var editable = false;
                if ( status_prefs.length > 0 ) {
                    var value = status_prefs[0].get('Value');
                    var status_object = Ext.JSON.decode(value);
                    statusValue = status_object.status;
                    // Check for any status that allows edit
                    if ( statusValue === TSTimesheet.STATUS.NOT_SUBMITTED || statusValue === TSTimesheet.STATUS.UNKNOWN  ) { 
                        editable = true;
                    }
                } else {
                    // No current status, is currently not submitted
                    editable = true;
                }
                status_box.add({xtype:'container',html:'Status: ' + statusValue});
                
                if ( week_lock_prefs.length > 0 ) {
                    var value = week_lock_prefs[0].get('Value');
                    var status_object = Ext.JSON.decode(value);

                    if ( status_object.status == "Locked" ) { 
                        editable = false;
                        status_box.add({xtype:'container',html:'Status: Week Locked'});
                    }
                }

                this.time_table = this.add({ 
                    xtype: 'tstimetable',
                    region: 'center',
                    layout: 'fit',
                    margin: 15,
                    localWeekStartDate: this.localWeekStartDate,
                    editable: editable,
                    listeners: {
                        scope: this,
                        gridReady: function() {
                            this._addButtons(button_box);
                            if ( editable ) {
                                this._enableButtons();
                            }
                            this._addStatusControls(statusValue);
                        }
                    }
                });
            },
            failure: function(msg) {
                Ext.Msg.alert("Problem loading approval information", msg);
            }
        });
    },
    
    _disableButtons: function() {
        Ext.Array.each( this.query('rallybutton'), function(button) {
            button.setDisabled(true);
        });
    },
    
    _enableButtons: function() {
        Ext.Array.each( this.query('rallybutton'), function(button) {
            button.setDisabled(false);
        });
    },
    
    _getWeekStartFromKey: function(key) {
        var name_array = key.get('Name').split('.');
        
        if ( name_array.length < 5 ) {
            return null;
        }
        
        return name_array[4];
        
    },
    
    _absorbOldApprovedTimesheets: function() {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        this.setLoading('Reviewing Past Timesheets');
        
        //var this_week_start = TSDateUtils.getUtcIsoForLocalDate(new Date());
        var this_week_start = TSDateUtils.formatShiftedDate(new Date(),'Y-m-d');
        
        var append_filters = Rally.data.wsapi.Filter.and([
            { property: 'Name', operator:'contains', value: Rally.technicalservices.TimeModelBuilder.appendKeyPrefix },
            { property: 'Name', operator:'<', value: Rally.technicalservices.TimeModelBuilder.appendKeyPrefix + '.' + this_week_start },
            { property: 'Name', operator:'contains', value: this.getContext().getUser().ObjectID}
        ]);
        
        var amend_filters = Rally.data.wsapi.Filter.and([
            { property: 'Name', operator:'contains', value: Rally.technicalservices.TimeModelBuilder.amendKeyPrefix },
            { property: 'Name', operator:'<', value: Rally.technicalservices.TimeModelBuilder.amendKeyPrefix + '.' + this_week_start },
            { property: 'Name', operator:'contains', value: this.getContext().getUser().ObjectID}
        ]);
        
        var change_filters = append_filters.or(amend_filters);
        
        var non_archived_filters = Rally.data.wsapi.Filter.and([
            { property: 'Name', operator:'!contains', value: TSUtilities.archiveSuffix }
        ]);
        
        var filters = change_filters.and(non_archived_filters);
                
        var config = {
            model: 'Preference',
            filters: filters,
            fetch: ['Name','Value','ObjectID'],
            sorters: [{property:'Name', direction: 'DESC'}]
        }
        
        TSUtilities.loadWsapiRecords(config).then({
            scope: this,
            success: function(preferences) {
                    
                    var week_hash = {};
                    Ext.Array.each(preferences, function(preference){
                        var key = me._getWeekStartFromKey(preference);
                        if ( Ext.isEmpty(week_hash[key]) ) { 
                            week_hash[key] = [];
                        }
                        week_hash[key].push(preference);
                    });
                    
                                        
                    var promises = [];
                    
                    Ext.Object.each(week_hash, function(changed_week, preferences){
                        promises.push( function() { return me._absorbOldApprovedTimesheet(changed_week,preferences); } );
                    });
                                        
                    Deft.Chain.sequence(promises).then({
                        success: function(results) {
                            deferred.resolve(Ext.Array.sum(results));
                        },
                        failure: function(msg) { deferred.reject(msg); }
                    
                    });
            },
            failure: function(msg) { deferred.reject(msg); }
        });
        
        return deferred.promise;
    },
    
    _absorbOldApprovedTimesheet: function(week_start,changes) {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
            
        // is this approved?
        this.setLoading('Reviewing ' + week_start);
        
        TSDateUtils.isApproved(week_start).then({
            scope: this,
            success: function(result) {
                if ( !result ) {

                    deferred.resolve(0);
                    return;
                }
                
                this.setLoading('Absorbing Manager Change ' + week_start);
                
                var timetable = Ext.create('Rally.technicalservices.TimeTable',{
                    localWeekStartDate: Ext.Date.parse(week_start,'Y-m-d'),
                    editable: false,
                    timesheet_status: TSTimesheet.STATUS.APPROVED,
                    timesheet_user: this.getContext().getUser(),
                    listeners: {
                        scope: this,
                        gridReady: function(t, grid) {
                            if ( grid.getStore().isLoading() ) {
                                grid.getStore().on('load', function() {
                                    this._absorbChanges(t,changes).then({
                                        success: function(results) {
                                            
                                            deferred.resolve(1);
                                        },
                                        failure: function(msg) { 
                                            deferred.reject(msg);
                                        }
                                    });
                                }, this, { single: true });
                            } else {
                                this._absorbChanges(t,changes).then({
                                    success: function(results) {
                                        
                                        deferred.resolve(1);
                                    },
                                    failure: function(msg) { 
                                        deferred.reject(msg);
                                    }
                                });
                            }
                        }
                    }
                });
                
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
            
        });
        return deferred.promise;
    },
    
    _absorbChanges: function(timetable,changes) {
        var deferred = Ext.create('Deft.Deferred');
        
        var promises = [];
        
        Ext.Array.each(changes, function(change) {
            var value = Ext.JSON.decode(change.get('Value'));
            value.ObjectID = change.get('ObjectID');
            value.__PrefID = change.get('ObjectID');
            
            var row = Ext.create('TSTableRow', value);
            promises.push( function() { return timetable.absorbTime(row); });
        });
                
        Deft.Chain.sequence(promises).then({
            success: function(results) {
                
                deferred.resolve(results);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },

    _loadWeekStatusPreference: function() {        
        var key = Ext.String.format("{0}.{1}.{2}", 
            TSUtilities.approvalKeyPrefix,
            TSDateUtils.getUtcIsoForLocalDate(this.localWeekStartDate),
            this.getContext().getUser().ObjectID
        );

        
        return TSDateUtils._loadWeekStatusPreference(key);
    },
    
    _loadWeekLockPreference: function() {
        
        var key = Ext.String.format("{0}.{1}", 
            TSUtilities.timeLockKeyPrefix,
            TSDateUtils.getUtcIsoForLocalDate(this.localWeekStartDate)
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
    
    _addCurrentTasks: function() {
        var timetable = this.down('tstimetable');
        if (timetable) {
            this.setLoading("Finding my current tasks...");
            var config = {
                model: 'Task',
                context: {
                    project: null
                },
                fetch: Ext.Array.merge(
                    Rally.technicalservices.TimeModelBuilder.getFetchFields(),
                    this.task_fetch_fields
                ),
                filters: [
                    {property:'Owner.ObjectID',value:this.getContext().getUser().ObjectID},
                    {property:'Iteration.StartDate',operator: '<=', value:Rally.util.DateTime.toIsoString(new Date())},
                    {property:'Iteration.EndDate',  operator: '>=', value:Rally.util.DateTime.toIsoString(new Date())}
                ]
            };
            
            TSUtilities.loadWsapiRecords(config).then({
                scope: this,
                success: function(tasks) {
                    var new_item_count = tasks.length;
                    var current_count  = timetable.getGrid().getStore().getTotalCount();
                    
                    if ( current_count + new_item_count > 100 ) {
                        Ext.Msg.alert('Problem Adding Items', 'Cannot add items to grid. Limit is 100 lines in the time sheet.');
                        this.setLoading(false);
                    } else {
                        Ext.Array.each(tasks, function(task){
                            timetable.addRowForItem(task);
                        });
                        this._addPinnedItems();
                    }
                    
                    
                },
                failure: function(msg) {
                    Ext.Msg.alert("Problem loading current tasks", msg);
                }
            });
        }
    },
    
    _addPinnedItems: function() {
        var me = this,
            timetable = this.down('tstimetable');

        if ( timetable.getDefaultPreference().getPinnedOIDs().length === 0 ) {
            this.setLoading(false);
            return;
        }
        
        Deft.Chain.sequence([ 
            function() { return this._addPinnedItemsByType('hierarchicalrequirement', this.story_fetch_fields); },
            function() { return this._addPinnedItemsByType('defect', this.defect_fetch_fields); },
            function() { return this._addPinnedItemsByType('task', this.task_fetch_fields); }
            
        ], this)
        .then({
            scope: this,
            success: function() {
                this.setLoading(false);
            },
            failure: function(msg) {
                Ext.Msg.alert("Problem loading pinned items",msg);
                this.setLoading(false);
            }
        });
    },
    
    _addPinnedItemsByType: function(type, fetchFields) {
        var deferred = Ext.create('Deft.Deferred');
        var timetable = this.down('tstimetable');
        
        if (!timetable) {
            return; 
        }
        
        this.setLoading("Finding items of type " + type + "...");
        
        var oids = timetable.getDefaultPreference().getPinnedOIDs();
        var config = {
            model: type,
            context: {
                project: null
            },
            fetch: Ext.Array.merge(
                Rally.technicalservices.TimeModelBuilder.getFetchFields(),
                fetchFields
            ),
            filters: Rally.data.wsapi.Filter.or(Ext.Array.map(oids, function(oid) { return {property:'ObjectID',value:oid}; }))
        };
        
        TSUtilities.loadWsapiRecords(config).then({
            scope: this,
            success: function(items) {
                var promises = [];
                
                var new_item_count = items.length;
                var current_count  = timetable.getGrid().getStore().getTotalCount();
                
                if ( current_count + new_item_count > 100 ) {
                    deferred.reject( 'Cannot add items to grid. Limit is 100 lines in the time sheet.');
                } else {
                 
                    Ext.Array.each(items, function(item){
    
                        if ( item.get('Release') && item.get('Release').c_IsDeployed == true ) {
                            
                            
                            promises.push(function() { return timetable.unpinTime(item); });
                            
                            return;
                        }
                        timetable.addRowForItem(item);
                    });
                    
                    if ( promises.length === 0 ) {
                        deferred.resolve(items);
                    } else {
                        Deft.Chain.sequence(promises).then({
                            success: function(results) {
                                deferred.resolve(results);
                            },
                            failure: function(msg) {
                                deferred.reject(msg);
                            }
                        });
                    }
                }
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
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
                fetchFields: fetch_fields,
                listeners: {
                    artifactchosen: function(dialog, selectedRecords){
                        if ( !Ext.isArray(selectedRecords) ) {
                            selectedRecords = [selectedRecords];
                        }
                        
                        var new_item_count = selectedRecords.length;
                        var current_count  = timetable.getGrid().getStore().getTotalCount();
                        
                        if ( current_count + new_item_count > 100 ) {
                            Ext.Msg.alert('Problem Adding Tasks', 'Cannot add items to grid. Limit is 100 lines in the time sheet.');
                        } else {
                            
                            Ext.Array.each(selectedRecords, function(selectedRecord){
                                timetable.addRowForItem(selectedRecord);
                            });
                        }
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
                fetchFields: fetch_fields,
                listeners: {
                    artifactchosen: function(dialog, selectedRecords){
                        if ( !Ext.isArray(selectedRecords) ) {
                            selectedRecords = [selectedRecords];
                        }
                        
                        var new_item_count = selectedRecords.length;
                        var current_count  = timetable.getGrid().getStore().getTotalCount();
                        
                        if ( current_count + new_item_count > 100 ) {
                            Ext.Msg.alert('Problem Adding Tasks', 'Cannot add items to grid. Limit is 100 lines in the time sheet.');
                        } else {
                            
                            Ext.Array.each(selectedRecords, function(selectedRecord){
                                timetable.addRowForItem(selectedRecord);
                            });
                        }
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
                        displayName: TSCommonSettings.getLowestPortfolioItemTypeName() + ' Project',
                        attributeName: TSCommonSettings.getLowestPortfolioItemTypeName() + '.Project.Name'
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
                        
                        var new_item_count = selectedRecords.length;
                        var current_count  = timetable.getGrid().getStore().getTotalCount();
                        
                        if ( current_count + new_item_count > 100 ) {
                            Ext.Msg.alert('Problem Adding Stories', 'Cannot add items to grid. Limit is 100 lines in the time sheet.');
                        } else {
                            Ext.Array.each(selectedRecords, function(selectedRecord){
                                timetable.addRowForItem(selectedRecord);
                            });
                        }
                    },
                    scope: this
                }
             });
        }
    },
    
    getSettingsFields: function() {
        var me = this;
        
        return [
            {
                name: 'preferenceProjectRef',
                xtype:'rallyprojectpicker',
                fieldLabel: 'Preference Project',
                workspace: this.getContext().getWorkspaceRef(),
                showMostRecentlyUsedProjects : false,
                autoExpand: true,
                labelWidth: 75,
                labelAlign: 'left',
                minWidth: 200,
                margin: 10
            },
            Ext.merge({
                labelWidth: 75,
                labelAlign: 'left',
                minWidth: 200,
                margin: 10
            },TSCommonSettings.getStartDayOfWeekSettingField())
        ];
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