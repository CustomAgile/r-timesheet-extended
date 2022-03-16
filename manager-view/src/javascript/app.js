Ext.define("TSTimeSheetApproval", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    
    layout: 'border', 
    
    items: [
        {xtype:'container', itemId:'selector_box', region: 'north',  layout: { type:'hbox' }},
        {xtype:'container', itemId:'display_box' , region: 'center', layout: { type: 'fit'} }
    ],

    _commentKeyPrefix: 'rally.technicalservices.timesheet.comment',

    integrationHeaders : {
        name : "TSTimeSheetApproval"
    },
    
    stateFilterValue: TSTimesheet.STATUS.SUBMITTED,
    
    config: {
        defaultSettings: {
            managerField: 'DisplayName',
            showAllForAdmins: true,
            preferenceProjectRef: '/project/51712374295'
        }
    },
    
    launch: function() {
        var preference_project_ref = this.getSetting('preferenceProjectRef');
        if ( !  TSUtilities.isEditableProjectForCurrentUser(preference_project_ref,this) ) {
            Ext.Msg.alert('Contact your Administrator', 'This app requires editor access to the preference project.');
        }
        TSCommonSettings.initLowestPortfolioItemTypeName().then({
            scope: this,
            success: function() {
               this._addSelectors(this.down('#selector_box'));
            }
        });
    },
    
    _addSelectors: function(container) {
        container.removeAll();
        
        container.add({
            xtype:'rallybutton',
            cls: 'secondary',
            text: '<span class="icon-expandall"> </span>',
            expanded: false,
            listeners: {
                scope: this,
                click: function(button) {
                    if ( button.expanded == true ) {
                        button.expanded = false;
                        button.setText('<span class="icon-expandall"> </span>');
                        var grid = this.down('rallygrid');
                        if ( grid ) {
                            grid.getView().features[0].collapseAll();
                        }
                    } else {
                        button.expanded = true;
                        button.setText('<span class="icon-collapseall"> </span>');
                        var grid = this.down('rallygrid');
                        if ( grid ) {
                            grid.getView().features[0].expandAll();
                        }
                    }
                }
            }
        });
        
        container.add({
            xtype:'rallybutton',
            itemId:'export_button',
            cls: 'secondary',
            text: '<span class="icon-export"> </span>',
            disabled: true,
            listeners: {
                scope: this,
                click: function() {
                    this._export();
                }
            }
        });
        
        var state_store = Ext.create('Ext.data.Store',{
            fields: ['displayName','value'],
            data: [
                {displayName:'All',  value: TSTimesheet.STATUS.ALL},
                {displayName:'Not Submitted', value: TSTimesheet.STATUS.NOT_SUBMITTED},
                {displayName:'Submitted', value: TSTimesheet.STATUS.SUBMITTED},
                {displayName:'Approved', value: TSTimesheet.STATUS.APPROVED},
                {displayName:'Processed', value: TSTimesheet.STATUS.PROCESSED}
            ]
        });

        container.add({xtype:'container',flex: 1});
        
        container.add({
            xtype:'combobox',
            value: this.stateFilterValue,
            fieldLabel: 'Timesheet State:',
            store: state_store,
            queryMode: 'local',
            displayField: 'displayName',
            valueField: 'value',
            margin: 10,
            width: 200,
            listeners: {
                scope: this,
                change: function(cb) {
                    this.stateFilterValue = cb.getValue();
                }
            }
        });
        
        var date_container = container.add({
            xtype:'container',
            layout: 'vbox',
            margin: 3
        });
        
        var week_start = Rally.util.DateTime.add(new Date(), 'week', -4);
        
        date_container.add({
            xtype:'rallydatefield',
            itemId:'from_date_selector',
            fieldLabel: 'From Week',
            listeners: {
                scope: this,
                change: function(cmp, newValue) {
                    var weekStart = TSDateUtils.getBeginningOfWeekForLocalDate(newValue);
                    if ( Ext.Date.isEqual(weekStart, newValue) ) {
                        // Selected date is now aligned with week start
                        // nothing to do
                    } else {
                        cmp.setValue(weekStart);    // This will fire another change event
                    }
                }
            }
        }).setValue(week_start)
        
        date_container.add({
            xtype:'rallydatefield',
            itemId:'to_date_selector',
            fieldLabel: 'Through Week',
            listeners: {
                scope: this,
                change: function(cmp, newValue) {
                    var weekStart = TSDateUtils.getBeginningOfWeekForLocalDate(newValue);
                    if ( Ext.Date.isEqual(weekStart, newValue) ) {
                        // Selected date is now aligned with week start
                        // nothing to do
                    } else {
                        cmp.setValue(weekStart);    // This will fire another change event
                    }
                }
            }
        }).setValue(Rally.util.DateTime.add(new Date(), 'week', -1));
        
        container.add({
            xtype:'rallybutton',
            itemId: 'go_button',
            text:'Go',
            margin: '15 3 3 3',
            disabled: false,
            listeners: {
                scope: this,
                click: this._updateData
            }
        });
        
        container.add({xtype:'container',flex: 1});

        //if ( this.isExternal() ) {
            container.add({type:'container', html: '&nbsp;&nbsp;&nbsp;', border: 0, padding: 10});
        //}
        
    },
    
    _updateData: function() {
        this.setLoading('Loading timesheets...');
        
        this.down('#display_box').removeAll();
        
        // UTC dates of app start of week day (not Sunday based)
        this.startWeekDate = this.down('#from_date_selector').getValue();
        this.endWeekDate   = this.down('#to_date_selector').getValue();
        
        if ( this.pipeline && this.pipeline.getState() === 'pending' ) {
            this.pipeline.cancel();
        }
        
        this.pipeline = Deft.Chain.pipeline([
            this._loadTimesheets,
            this._loadPreferences,
            this._loadComments
        ],this);
        
        this.pipeline.then({
            scope: this,
            success: function(timesheets) {
                this._addGrid(this.down('#display_box'), timesheets);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading users with timesheets', msg);
            }
        }).always(function() {
            this.setLoading(false);
        }, this);
    },
    
    // Resolves to an Array of TSTimesheet objects
    _loadTimesheets: function() {
        
        // First load the time entry values for the requested date range.
        var queries = [
            // TODO (tj) disabling until required --> {property:'User.NoTimesheet', value: false },
            {property:'TimeEntryItem.User.Disabled', value: false }
        ];
        if ( ! this.getSetting('showAllForAdmins') || !TSUtilities.currentUserIsAdmin() ){
            var current_user_name = this.getContext().getUser().UserName;
            queries.push({
                property:'TimeEntryItem.User.' + this.getSetting('managerField'),
                operator: 'contains',
                value: current_user_name}
            );
        }
        queries.push({
            property: 'DateVal',
            operator: '>=',
            value: TSDateUtils.getUtcIsoForLocalDate(this.startWeekDate, true) // This is app week start date (not sunday based)
        });
        // Find first date of week start AFTER the end date week start to include values in the end week
        var endDate = TSDateUtils.getUtcIsoForLocalDate(Ext.Date.add(this.endWeekDate, Ext.Date.DAY, 7), true);
        queries.push({
            property: 'DateVal',
            operator: '<',
            value: endDate
        });
        var store = Ext.create('Rally.data.wsapi.Store', {
            model: 'TimeEntryValue',
            autoLoad: false,
            filters: queries,
            context: {
                project: null,
            },
            fetch: ['DateVal', 'Hours', 'TimeEntryItem', 'User', 'ObjectID', 'WeekStartDate', 'UserName', this.getSetting('managerField')]
        });
        return this._getTimeEntryValues(store, 0, {})
    },
    
    _getTimeEntryValues: function(store, startIndex, timesheets) {
        return store.load().then({
            scope: this,
            success: function(results) {
                this._processTimeEntryValues(timesheets, results);
                var valuesProcessed = results.length + startIndex;
                if ( valuesProcessed < store.getTotalCount() ) {
                    // do it again with next page of data
                    return this._getTimeEntryValues(store, valuesProcessed-1, timesheets);
                } else {
                    return _.map(timesheets, function(timesheetConfig) {
                        return Ext.create('TSTimesheet', timesheetConfig);  
                    });
                }
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading users with timesheets', msg);
            }
        }); 
    },
    
    _processTimeEntryValues: function(timesheets, timeEntryValues) {
        _.each(timeEntryValues, function(timeEntryValue) {
            var timeEntryItem = timeEntryValue.get('TimeEntryItem');
            var userOid = timeEntryItem.User.ObjectID;
            // Convert the time entry value date value to the app start of week date
            var tevWeekStart = TSDateUtils.getUtcStartOfWeekForLocalDate(timeEntryValue.get('DateVal'));
            var key = Ext.String.format('{0}-{1}', userOid, tevWeekStart);
            
            if ( !timesheets[key] ) {
                timesheets[key] = {
                    User: timeEntryItem.User,
                    WeekStartDate: new Date(tevWeekStart),
                    __UserName: timeEntryItem.User.UserName,
                    __Status: TSTimesheet.STATUS.UNKNOWN,
                    __Hours: 0
                };
            }
            timesheets[key].__Hours += timeEntryValue.get('Hours');
        });
        return;
    },
    
    _loadPreferences: function(timesheets) {
        var deferred = Ext.create('Deft.Deferred');
        this.setLoading("Loading statuses...");
        var stateFilter = this.stateFilterValue;
        
        var filters = [
            {property:'Name',operator:'contains',value:TSUtilities.approvalKeyPrefix},
            {property:'Name',operator:'!contains',value: TSUtilities.archiveSuffix}
        ];
        
        var config = {
            model:'Preference',
            limit: 'Infinity',
            filters: filters,
            fetch: ['Name','Value'],
            sorters: [{property:'CreationDate',direction:'ASC'}]
        };
        
        TSUtilities.loadWsapiRecords(config).then({
            scope: this,
            success: function(preferences) {

                var preferences_by_key = {};
                
                Ext.Array.each(preferences, function(pref){
                    var pref_name_array = pref.get('Name').split('.');
                    pref_name_array.pop();
                    
                    preferences_by_key[pref_name_array.join('.')] = pref;
                });
                

                
                Ext.Array.each(timesheets, function(timesheet){
                    var key = timesheet.getShortPreferenceKey();

                    if (preferences_by_key[key]) {
                        var value = preferences_by_key[key].get('Value');
                        var status_object = {};
                        if ( /{/.test(value) ) {
                            status_object = Ext.JSON.decode(value);
                        } else {
                            status_object = {
                                status: value,
                                status_owner: { _refObjectName: '' }
                            }
                        }

                        timesheet.set('__Status', status_object.status || TSTimesheet.STATUS.NOT_SUBMITTED);
                        timesheet.set('__LastUpdateBy', status_object.status_owner._refObjectName || "");

                    } else { 
                        timesheet.set('__Status', TSTimesheet.STATUS.NOT_SUBMITTED);
                    }
                },this);
                                
                var filtered_timesheets = Ext.Array.filter(timesheets, function(timesheet){
                    if (stateFilter === TSTimesheet.STATUS.ALL) {
                        return true;
                    }
                    
                    return ( timesheet.get('__Status') === stateFilter );
                });
                
                this.setLoading(false);
                deferred.resolve(filtered_timesheets);
                
            },
            failure: function(msg){
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _loadComments: function(timesheets) {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        this.setLoading("Loading comments...");

        var timesheets_by_key = {};
        
        var filters = Ext.Array.map(timesheets, function(timesheet){
            var comment_key = Ext.String.format("{0}.{1}.{2}", 
                me._commentKeyPrefix,
                TSDateUtils.formatShiftedDate(timesheet.get('WeekStartDate'),'Y-m-d'),
                timesheet.get('User').ObjectID
            );
            
            timesheets_by_key[comment_key] = timesheet;
            
            return { property:'Name',operator: 'contains', value:comment_key };
        });
        
        var promises = [];
        
        Ext.Array.each(filters, function(filter){
            var config = {
                model:'Preference',
                limit: 'Infinity',
                filters: [filter],
                fetch: ['Name','Value'],
                context: {
                    project: null
                }
            };
            
            promises.push( function() { return TSUtilities.loadWsapiRecords(config); } );
        });
        
        CA.techservices.promise.ParallelThrottle.throttle(promises, 6, me).then({
                success: function(results){
                    var comments = Ext.Array.flatten(results);
                    
                    Ext.Array.each(comments, function(comment){
                        var name_array = comment.get('Name').split(/\./);
                        name_array.pop();
                        var key = name_array.join('.');
                                                
                        var timesheet = timesheets_by_key[key];
                        if ( Ext.isEmpty(timesheet) ) { 

                            return;
                        }
                                                
                        var timesheet_comments = timesheet.get('__Comments');
                        if ( Ext.isEmpty(timesheet_comments) ) {
                            timesheet_comments = [];
                        }
                        timesheet_comments.push(comment);
                        timesheet.set('__Comments', timesheet_comments);
                    });
                    
                    deferred.resolve( Ext.Object.getValues(timesheets_by_key) );
                },
                failure: function(msg) {
                    deferred.reject(msg);
                }
        });        
        
        
        return deferred.promise;
    },
    
    _addHoursFromTimeEntryItem: function(hours,item){
        var summary = item.get('Summary');
        if ( summary && summary.Values && summary.Values.Hours ) {
            var hour_summary = summary.Values.Hours;
            Ext.Object.each(hour_summary, function(key,value){
                hours = hours + ( key * value ) ;
            });
        }
        return hours;
    },

    _addGrid: function(container, timesheets) {

        
        var store = Ext.create('Rally.data.custom.Store',{
            data:timesheets,
            groupField: 'User',
            groupDir: 'ASC',
            pageSize: 50000,
            model: 'TSTimesheet',
            sorters: [{property:'__UserName'}, {property:'WeekStartDate', direction: 'DESC'}],
            getGroupString: function(record) {
                var owner = record.get('User');
                return (owner && owner._refObjectName) || 'No Owner';
            }
        });
        
        var columns = this._getColumns();
        
        container.add({
            xtype:'rallygrid',
            store: store,
            columnCfgs: columns,
            enableEditing: false,
            showRowActionsColumn: true,
            rowActionColumnConfig: {
                xtype: 'tsrowactioncolumn'
            },
            enableBulkEdit: true,
            showPagingToolbar: false,
            features: [{
                ftype: 'groupingsummary',
                startCollapsed: true,
                groupHeaderTpl: '{name} ({rows.length})'
            }],
            _recordIsSelectable: function(record) {
                return true;
            },
            listeners: {
                scope: this,
                itemclick: function(grid, record, item, index, evt) {
                    var column = grid.getPositionByEvent(evt).column;
                    if ( column > 1 ) {
                        this._popup(record);
                    }
                },
                viewready: function() {
                    this.down('#export_button') && this.down('#export_button').setDisabled(false);
                },
                destroy: function() {
                    this.down('#export_button') && this.down('#export_button').setDisabled(true);
                }
            }
        });
    },
    
    _getColumns: function() {
        var me = this;
        var columns = [
            {
                dataIndex:'User',
                text:'User',
                renderer: function(v) { return v._refObjectName || value.UserName; }
            },
            {
                dataIndex:'WeekStartDate',
                text:'Week Starting',
                align: 'center',
                renderer: function(v) { 
                    return TSDateUtils.formatShiftedDate(v, 'm/d/y'); 
                }
            },{
                dataIndex:'__Hours',
                text:'Hours', 
                align: 'center',
                renderer: me._renderColor
            },
            {
                dataIndex:'__Status',
                text:'Status',
                align: 'center'
            },
            {
                dataIndex:'__LastUpdateBy',
                text:'Status Changed By',
                align: 'center'
            },
            {
                dataIndex:'User',
                text:'Manager',
                align: 'center',
                renderer: function(v) { 
                    return v[me.getSetting('managerField')] || "none"; 
                } 
            },
            {
                dataIndex: '__Comments',
                text: "Comments",
                align: 'center',
                renderer: function(v) {
                    if ( Ext.isEmpty(v) ) { return 0; }
                    if ( !Ext.isArray(v) ) { return 0; }
                    return v.length;
                }
            }
        ];
        return columns;
    },
    
    _popup: function(record){
        var user_name = record.get('User')._refObjectName;
        var status = record.get('__Status');

                
        Ext.create('Rally.technicalservices.ManagerDetailDialog', {
            id       : 'popup',
            width    : Ext.getBody().getWidth() - 150,
            height   : Ext.getBody().getHeight() - 150,
            title    : Ext.String.format("{0}: {1} ({2})", 
                user_name, 
                TSDateUtils.formatShiftedDate(record.get('WeekStartDate'),'j F Y'), 
                status
            ),
            autoShow : true,
            autoCenter: true,
            closable : true,
            commentKeyPrefix: this._commentKeyPrefix,
            record   : record,
            manager_field: this.getSetting('managerField')
        });
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
    
    _export: function(){
        var grid = this.down('rallygrid');
        
        if ( !grid ) { return; }
        
        var filename = 'manager-time-report.csv';
        this.setLoading("Generating CSV");
        var promises = [];
        var selected = grid.getSelectionModel().getSelection();
        if ( !selected || selected.length == 0 ){
            promises.push(Rally.technicalservices.FileUtilities.getCSVFromGrid(this,grid));
        } else {
            promises = _.map(selected, function(item, index) {
                return this._getCSVFromTimesheet(item,(index > 0) );
            }, this);
        }
                
        Deft.promise.Promise.all(promises).then({
            scope: this,
            success: function(results){
                var csv = results.join('\r\n');
                
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() {
            this.setLoading(false);
        }, this);
    },
    
    _getCSVFromTimesheet: function(timesheet,skip_headers) {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        
        var status = timesheet.get('__Status');
                    
        var timetable = Ext.create('Rally.technicalservices.TimeTable',{
            localWeekStartDate: timesheet.get('WeekStartDate'),
            editable: false,
            timesheet_status: timesheet.get('__Status'),
            timesheet_user: timesheet.get('User'),
            listeners: {
                scope: this,
                gridReady: function(timetable, grid) {
                    if ( grid.getStore().isLoading() ) {
                        grid.getStore().on('load', function() {
                            Rally.technicalservices.FileUtilities.getCSVFromGrid(me,grid,skip_headers)
                            .then(function(result){
                                deferred.resolve(result);  
                            });
                        }, this, { single: true });
                    } else {
                        Rally.technicalservices.FileUtilities.getCSVFromGrid(this,grid,skip_headers)
                        .then(function(result){
                            deferred.resolve(result);  
                        });
                    }
                }
            }
        });
        
        return deferred.promise;
    },
    
    _renderColor: function(value,metaData,record) {
        var white = "#ffffff";
        var red = '#fec6cd';
        var yellow = '#ffffcc';
        var orange ='#FF9933';
        var grey = '#D0D0D0';
        var color = grey;
       
        if ( value >= 40 && value < 67.51 ) {
            color = white;
        }
        if ( value < 40) {
            color = yellow;
        }
        
        
        var record_week_start = TSDateUtils.getUtcIsoForLocalDate(record.get('WeekStartDate'));
        var current_week_start = TSDateUtils.getUtcIsoForLocalDate(new Date());
        
        
        
        if ( record_week_start < current_week_start && value < 40 ) {
            color = red;
        }

        metaData.style = "background-color: " + color;
        return value;
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    _filterOutExceptStrings: function(store) {
        var app = Rally.getApp();

        
        store.filter([{
            filterFn:function(field){ 
                var attribute_definition = field.get('fieldDefinition').attributeDefinition;
                var attribute_type = null;
                if ( attribute_definition ) {
                    attribute_type = attribute_definition.AttributeType;
                }
                if (  attribute_type == "BOOLEAN" ) {
                    return false;
                }
                if ( attribute_type == "STRING") {
                    if ( !field.get('fieldDefinition').attributeDefinition.Constrained ) {
                        return true;
                    }
                }
                return false;
            } 
        }]);
    },
    
    getSettingsFields: function() {
        var me = this;
        
        return [{
            name: 'showAllForAdmins',
            xtype: 'rallycheckboxfield',
            boxLabelAlign: 'after',
            fieldLabel: '',
            margin: '0 0 25 10',
            boxLabel: 'Show All<br/><span style="color:#999999;"><i>Tick to show all timesheets regardless of manager for admins.</i></span>'
        },Ext.merge(
            {
                margin: '0 0 25 10',
            },
            TSCommonSettings.allowManagerEditSettingsField
        ),
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
        {
            name: 'managerField',
            xtype: 'rallyfieldcombobox',
            fieldLabel: 'User Manager Field',
            labelWidth: 75,
            labelAlign: 'left',
            minWidth: 200,
            margin: 10,
            autoExpand: false,
            alwaysExpanded: false,
            model: 'User',
            listeners: {
                ready: function(field_box) {
                    me._filterOutExceptStrings(field_box.getStore());
                }
            },
            readyEvent: 'ready'
        },
        Ext.merge(
            {
                labelWidth: 75,
                labelAlign: 'left',
                minWidth: 200,
                margin: 10,
                model: 'PortfolioItem/' + TSCommonSettings.getLowestPortfolioItemTypeName()
            },
            TSCommonSettings.fetchManagerPortfolioItemFieldsSettingField
        ),
        Ext.merge({
                labelWidth: 75,
                labelAlign: 'left',
                minWidth: 200,
                margin: 10,
            },TSCommonSettings.getStartDayOfWeekSettingField())
        ]
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){

        // Ext.apply(this, settings);
        this.launch();
    }
});
