Ext.define('Rally.data.lookback.WsapiProxyOverride', {
    override: 'Rally.data.wsapi.Proxy',
    timeout: 300000
});

Ext.define("TSFinanceReport", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),

    defaults: { margin: 10 },
    
    layout: 'border', 
    
    stateFilterValue: TSTimesheet.STATUS.ALL,
    
    items: [
        {xtype:'container', itemId:'selector_box', region: 'north',  layout: { type:'hbox' }},
        {xtype:'container', itemId:'display_box' , region: 'center', layout: { type: 'fit'} }
    ],

    integrationHeaders : {
        name : "TSFinanceReport"
    },
    
    config: {
        defaultSettings: {
            managerField: 'DisplayName'
        }
    },
    
    launch: function() {
        this._addSelectors(this.down('#selector_box'));
    },
    
    _addSelectors: function(container) {
        container.removeAll();
                
        var date_container = container.add({
            xtype:'container',
            layout: 'vbox'
        });
        
        var week_start = this._getBeginningOfWeek(Rally.util.DateTime.add(new Date(), 'week', -4));
        
        date_container.add({
            xtype:'rallydatefield',
            itemId:'from_date_selector',
            fieldLabel: 'From',
            labelWidth: 50,
            value: week_start,
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    this._enableGoButton();
                }
            }
        });
        
        date_container.add({
            xtype:'rallydatefield',
            itemId:'to_date_selector',
            fieldLabel: 'Through',
            labelWidth: 50,
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    this._enableGoButton();
                }
            }
        }).setValue(new Date());
        
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
        
        var spacer = container.add({ xtype: 'container', flex: 1});
        
        container.add({
            xtype:'rallybutton',
            itemId:'export_button',
            text: '<span class="icon-export"> </span>',
            disabled: false,
            listeners: {
                scope: this,
                click: function() {
                    this._export();
                }
            }
        });
        
        if ( this.isExternal() ) {
            container.add({type:'container', html: '......'});
        }
        
    },
    
    _enableGoButton: function() {
        var start_calendar = this.down('#from_date_selector');
        var to_calendar    = this.down('#to_date_selector');
        
        var go_button = this.down('#go_button');
        
        go_button && go_button.setDisabled(true);
        
        if ( start_calendar && to_calendar ) {
            go_button && go_button.setDisabled(false);
        }

    },
    
    _updateData: function() {
        this.down('#display_box').removeAll();
        var go_button = this.down('#go_button');
        
        go_button && go_button.setDisabled(true);
        
        Deft.Chain.pipeline([
            this._loadTimesheets,
            this._loadPreferences
        ],this).then({
            scope: this,
            success: function(timesheets) {
                this.setLoading("Preparing Data...");
                

                var time_rows = this._getRowsFromTimesheets(timesheets);
                this._addGrid(this.down('#display_box'), time_rows);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading users with timesheets', msg);
                this.setLoading(false);
            }
        });
    },
    
    _loadTimesheets: function() {
        var deferred = Ext.create('Deft.Deferred'),
            tei_filters = [],
            tev_filters = [],
            me = this;
        this.setLoading("Loading timesheets...");
        
        var selector_start_date = this.down('#from_date_selector').getValue();
        
        var tei_start_date = TSDateUtils.getUtcIsoForLocalDate(selector_start_date,true);
        var tev_start_date = Rally.util.DateTime.toIsoString(selector_start_date ,false).replace(/T.*$/,'T00:00:00.000Z');
        tei_filters.push({property:'WeekStartDate', operator: '>=', value:tei_start_date});
        tev_filters.push({property:'DateVal', operator: '>=', value:tev_start_date});

        var end_date = TSDateUtils.formatShiftedDate( this.down('#to_date_selector').getValue(), 'Y-m-d');
        tei_filters.push({property:'WeekStartDate', operator: '<=', value:end_date});
        tev_filters.push({property:'DateVal', operator: '<=', value:end_date});
        
        var teitem_config = {
            model:'TimeEntryItem',
            limit: 'Infinity',
            filters: tei_filters,
            context: {
                project: null
            },
            fetch: ['WeekStartDate','ObjectID','UserName','Project','WorkProduct','WorkProductString',
                'User','OfficeLocation','NetworkID','c_EmployeeType','CostCenter'
            ]
        };
        
        var tevalue_config = {
            model:'TimeEntryValue',
            limit: 'Infinity',
            filters: tev_filters,
            context: {
                project: null
            },
            fetch: ['WeekStartDate','ObjectID','DateVal','Hours',
                'TimeEntryItem','WorkProduct', 'WorkProductDisplayString',
                'User','Project','Feature',
                'Release','c_DecommissionDate','State','c_DeploymentDate',
                'Task','TaskDisplayString','c_ActivityType','c_ProjectActivityType'
            ]
        };
        
        Deft.Chain.sequence([
            function() { 
                var msg = 'Loading Time Entry Items...';
                me.setLoading(msg);
                return TSUtilities.loadWsapiRecordsWithParallelPages(teitem_config, msg);  
            },
            function() { 
                msg = 'Loading Time Entry Values...';
                me.setLoading(msg);
                return TSUtilities.loadWsapiRecordsWithParallelPages(tevalue_config, msg); 
            },
            function() { 
                me.setLoading('Loading Appended Data...');
                return me._loadTimeEntryAppends(); 
            },
            function() { 
                me.setLoading('Loading Amended Data...');
                return me._loadTimeEntryAmends(); 
            }
        ],this).then({
            scope: this,
            success: function(results) {
                var time_entry_items  = results[0];
                var time_entry_values = results[1];
                var time_entry_appends = results[2] || [];
                var time_entry_amends = results[3] || [];
                
                var timesheets = this._getTimesheetsFromTimeEntryItems(time_entry_items);  // key is user_startdate
                timesheets = this._addTimeValuesToTimeSheets(timesheets,time_entry_values);
                
                var changes =  Ext.Array.merge(time_entry_appends, time_entry_amends);
                
                if ( changes.length > 0 ) {
                    timesheets = this._addChangesToTimeSheets(timesheets,changes);
                }
                
                deferred.resolve( Ext.Array.map(Ext.Object.getValues(timesheets), function(timesheet){
                    return Ext.create('TSTimesheet',timesheet);
                }));
                
                this.setLoading(false);
                
            },
            failure: function(msg){
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _loadTimeEntryAppends: function() {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        
        this.setLoading('Loading time entry additions...');

        var key = Ext.String.format("{0}", 
            Rally.technicalservices.TimeModelBuilder.appendKeyPrefix
        );
        
        var config = {
            model: 'Preference',
            context: {
                project: null
            },
            fetch: ['Name','Value','ObjectID'],
            filters: [
                {property:'Name',operator:'contains',value:key}
            ]
        };
        
        TSUtilities.loadWsapiRecords(config).then({
            success: function(results) {
                var changes = Ext.Array.map(results, function(result){
                    var key = result.get('Name');
                    var value = result.get('Value');
                    var change = Ext.JSON.decode(value);
                    
                    change.key = key;
                    return change;
                });
                
                // need to get workproduct, task, release and feature
                var task_oids = Ext.Array.unique(
                    Ext.Array.filter(
                        Ext.Array.map(
                            changes, 
                            function(change) { 
                                return change.Task && change.Task.ObjectID; 
                            }
                        ),
                        function(oid) {
                            return ( !Ext.isEmpty(oid) ) ; 
                        }
                    )
                );
                var workproduct_oids = Ext.Array.unique(
                    Ext.Array.filter(
                        Ext.Array.map(
                            changes, 
                            function(change) { 
                                return change.WorkProduct && change.WorkProduct.ObjectID; 
                            }
                        ),
                        function(oid) {
                            return ( !Ext.isEmpty(oid) ) ; 
                        }
                    )
                );
                                
                Deft.Chain.sequence([
                    function() { return me._loadAdditionalTasks(task_oids); },
                    function() { return me._loadAdditionalStories(workproduct_oids); },
                    function() { return me._loadAdditionalDefects(workproduct_oids); }
                ],this).then({
                    scope: this,
                    success: function(results) {
                        var tasks   = results[0];
                        var stories = results[1];
                        var defects = results[2];

                        var tasks_by_objectid = {};
                        Ext.Array.each(tasks, function(task) { tasks_by_objectid[task.get('ObjectID')] = task.getData(); });
                        var stories_by_objectid = {};
                        Ext.Array.each(stories, function(story) { stories_by_objectid[story.get('ObjectID')] = story.getData(); });
                        var defects_by_objectid = {};
                        Ext.Array.each(defects, function(defect) { defects_by_objectid[defect.get('ObjectID')] = defect.getData(); });
                                                
                        Ext.Array.each(changes, function(change){
                            if ( change.Task && change.Task.ObjectID ) {
                                change.Task = tasks_by_objectid[change.Task.ObjectID];
                            }
                            
                            if ( change.WorkProduct && change.WorkProduct.ObjectID ) {
                                change.WorkProduct = stories_by_objectid[change.WorkProduct.ObjectID] || defects_by_objectid[change.WorkProduct.ObjectID] || "missing";
                            }
                        });
                        

                        deferred.resolve(changes);
                    },
                    failure: function(msg) { 
                        deferred.reject(msg);
                    }
                });
                
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
    },
    
    _loadTimeEntryAmends: function() {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        
        this.setLoading('Loading time entry amendments...');
        
        var key = Ext.String.format("{0}", 
            Rally.technicalservices.TimeModelBuilder.amendKeyPrefix
        );
        
        var config = {
            model: 'Preference',
            context: {
                project: null
            },
            fetch: ['Name','Value','ObjectID'],
            filters: [
                {property:'Name',operator:'contains',value:key}
            ]
        };
        
        TSUtilities.loadWsapiRecords(config).then({
            success: function(results) {
                var changes = Ext.Array.map(results, function(result){
                    var key = result.get('Name');
                    var value = result.get('Value');
                    var change = Ext.JSON.decode(value);
                    
                    change.key = key;
                    return change;
                });
                
                // need to get workproduct, task, release and feature
                var task_oids = Ext.Array.unique(
                    Ext.Array.filter(
                        Ext.Array.map(
                            changes, 
                            function(change) { 
                                return change.Task && change.Task.ObjectID; 
                            }
                        ),
                        function(oid) {
                            return ( !Ext.isEmpty(oid) ) ; 
                        }
                    )
                );
                var workproduct_oids = Ext.Array.unique(
                    Ext.Array.filter(
                        Ext.Array.map(
                            changes, 
                            function(change) { 
                                return change.WorkProduct && change.WorkProduct.ObjectID; 
                            }
                        ),
                        function(oid) {
                            return ( !Ext.isEmpty(oid) ) ; 
                        }
                    )
                );
                                
                Deft.Chain.sequence([
                    function() { return me._loadAdditionalTasks(task_oids); },
                    function() { return me._loadAdditionalStories(workproduct_oids); },
                    function() { return me._loadAdditionalDefects(workproduct_oids); }
                ],this).then({
                    scope: this,
                    success: function(results) {
                        var tasks   = results[0];
                        var stories = results[1];
                        var defects = results[2];

                        var tasks_by_objectid = {};
                        Ext.Array.each(tasks, function(task) { tasks_by_objectid[task.get('ObjectID')] = task.getData(); });
                        var stories_by_objectid = {};
                        Ext.Array.each(stories, function(story) { stories_by_objectid[story.get('ObjectID')] = story.getData(); });
                        var defects_by_objectid = {};
                        Ext.Array.each(defects, function(defect) { defects_by_objectid[defect.get('ObjectID')] = defect.getData(); });
                        
                        Ext.Array.each(changes, function(change){
                            if ( change.Task && change.Task.ObjectID ) {
                                change.Task = tasks_by_objectid[change.Task.ObjectID];
                            }
                            
                            if ( change.WorkProduct && change.WorkProduct.ObjectID ) {
                                change.WorkProduct = stories_by_objectid[change.WorkProduct.ObjectID] || defects_by_objectid[change.WorkProduct.ObjectID] || "missing";
                            }
                        });
                        

                        deferred.resolve(changes);
                    },
                    failure: function(msg) { 
                        deferred.reject(msg);
                    }
                });
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
        
    },
    
    _loadAdditionalTasks: function(oids) {
        var filters = [{property:'ObjectID', value: -1}];
        if ( oids.length > 0 ) {
             filters = Rally.data.wsapi.Filter.or( Ext.Array.map(oids, function(oid) { return { property:'ObjectID', value: oid }; }) );
        }
        var config = {
            model: 'Task',
            context: { project: null },
            fetch: ['FormattedID','ObjectID','Name','c_ActivityType','c_ProjectActivityType'],
            filters: filters
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _loadAdditionalStories: function(oids) {
        var filters = [{property:'ObjectID', value: -1}];
        if ( oids.length > 0 ) {
            filters = Rally.data.wsapi.Filter.or( Ext.Array.map(oids, function(oid) { return { property:'ObjectID', value: oid }; }) );
        }
        var config = {
            model: 'HierarchicalRequirement',
            context: { project: null },
            fetch: ['FormattedID','ObjectID','Name','c_ActivityType','c_ProjectActivityType','Feature','Project',
                'Release','c_DecommissionDate','State','c_DeploymentDate'
            ],
            filters: filters
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _loadAdditionalDefects: function(oids) {
        var filters = [{property:'ObjectID', value: -1}];
        if ( oids.length > 0 ) {
             filters = Rally.data.wsapi.Filter.or( Ext.Array.map(oids, function(oid) { return { property:'ObjectID', value: oid }; }) );
        }
        
        var config = {
            model: 'Defect',
            context: { project: null },
            fetch: ['FormattedID','ObjectID','Name','c_ActivityType','c_ProjectActivityType','Feature','Project',
                'Release','c_DecommissionDate','State','c_DeploymentDate'
            ],
            filters: filters
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _loadPreferences: function(timesheets) {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        this.setLoading("Loading statuses...");
        

        
        var stateFilter = this.stateFilterValue;
        
        var filters = [
            {property:'Name',operator:'contains', value:TSUtilities.approvalKeyPrefix},
            {property:'Name',operator:'!contains',value: TSUtilities.archiveSuffix}
        ];
        
        var config = {
            model:'Preference',
            limit: Infinity,
            filters: filters,
            fetch: ['Name','Value'],
            sorters: { property:'CreationDate', direction: 'ASC' }
        };
        
        TSUtilities.loadWsapiRecords(config).then({
            scope: this,
            success: function(preferences) {

                var preferences_by_key = {};
                
                Ext.Array.each(preferences, function(pref){
                    var key_array = pref.get('Name').split('.');
                    if ( key_array.length > 6) {
                        key_array.pop();
                    }
                    preferences_by_key[key_array.join('.')] = pref;
                });
                
                Ext.Array.each(timesheets, function(timesheet){
                    var key = timesheet.getPreferenceKey();
                    if (preferences_by_key[key]) {


                        var value = preferences_by_key[key].get('Value');
                        if ( Ext.isEmpty(value) ) {

                            return;
                        }
                        
                        if ( !/\{/.test(value) ) {

                            return;
                        }
                        
                        var status_object = Ext.JSON.decode(value);

                        timesheet.set('__Status', status_object.status || TSTimesheet.STATUS.NOT_SUBMITTED);
                        timesheet.set('__LastUpdateBy', status_object.status_owner._refObjectName || "");
                        timesheet.set('__LastUpdateDate', status_object.status_date);
                        
                    } else { 
                        timesheet.set('__Status', TSTimesheet.STATUS.NOT_SUBMITTED);
                    }
                });


                
                this.setLoading(false);
                deferred.resolve(timesheets);
                
            },
            failure: function(msg){
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },

    _getTimesheetsFromTimeEntryItems: function(time_entry_items) {
        var timesheets = { };
        Ext.Array.each(time_entry_items, function(item){
            var key = Ext.String.format("{0}_{1}",
                item.get('User').ObjectID,
                TSDateUtils.formatShiftedDate(item.get('WeekStartDate'),'Y-m-d')
            );
            
            if ( ! timesheets[key] ) {
                timesheets[key] = Ext.Object.merge( item.getData(), { 
                    __UserName: item.get('User').UserName,
                    __Hours: 0,
                    __Status: TSTimesheet.STATUS.UNKNOWN,
                    __AllTimeEntryItems: []
                });
            }
            
            timesheets[key].__AllTimeEntryItems.push(item);
        },this);
        
        
        return timesheets;
    },
    
    _addTimeValuesToTimeSheets: function(timesheets,time_entry_values) {
        var time_entry_values_by_item_oid = {};
        
        Ext.Array.each(time_entry_values, function(value){
            var item_oid = value.get('TimeEntryItem').ObjectID;
            if ( Ext.isEmpty( time_entry_values_by_item_oid[item_oid] )) {
                time_entry_values_by_item_oid[item_oid] = [];
            }
            time_entry_values_by_item_oid[item_oid].push(value);
        });
        
        Ext.Object.each(timesheets, function(key,timesheet){
            var items = timesheet.__AllTimeEntryItems;
            var timesheet_values = timesheet.__TimeEntryValues;
            if ( Ext.isEmpty(timesheet_values) ) { timesheet_values = []; }
            
            Ext.Array.each(items, function(item){
                var item_oid = item.get('ObjectID');
                
                var values = time_entry_values_by_item_oid[item_oid];
                if (Ext.isArray(values)) {
                    timesheet_values = Ext.Array.push(timesheet_values,values);
                }
            });
            
            timesheet.__TimeEntryValues = timesheet_values;
        });
        
        return timesheets;
        
    },
    
    _addChangesToTimeSheets: function(timesheets, changes) {
        var changes_by_user_and_date = {};
        
        Ext.Array.each(changes, function(change){
            var work_item = change.Task;
            if ( Ext.isEmpty(work_item) ) {
                work_item = change.WorkProduct;
            }
            
            var item_oid = work_item.ObjectID;
            
            var user_oid = change.User.ObjectID;
            
            var name_array = change.key.split('.');
            var week_start_date = name_array[4];
            
            var key = user_oid + "_" + week_start_date;
                        
            if ( Ext.isEmpty( changes_by_user_and_date[key] )) {
                changes_by_user_and_date[key] = [];
            }
            changes_by_user_and_date[key].push(change);
        });
                
        Ext.Object.each(timesheets, function(key,timesheet){
            if ( changes_by_user_and_date[key] ) {
                if ( Ext.isEmpty(timesheet.__TimeEntryChanges ) ) {
                    timesheet.__TimeEntryChanges = [];
                }
                
                var saved_changes = timesheet.__TimeEntryChanges;
                timesheet.__TimeEntryChanges = Ext.Array.push(saved_changes, changes_by_user_and_date[key]);
            }
        });
        return timesheets;
    },
    
    _getRowsFromTimesheets: function(timesheets){

        
        var rows = this._getRowsFromTimeValuesInTimesheets(timesheets);
        
        var additional_rows = this._getRowsFromChangesInTimesheets(timesheets);
        
        return Ext.Array.merge(rows,additional_rows);
    },
    
    _getRowsFromTimeValuesInTimesheets: function(timesheets) {
        var rows = [];
        
        Ext.Object.each(timesheets, function(key,timesheet){
            var time_values = timesheet.get('__TimeEntryValues');
            Ext.Array.each(time_values, function(time_value){
                var isOpEx = false;
                
                var product = time_value.get('TimeEntryItem').Project;
                var workproduct = time_value.get('TimeEntryItem').WorkProduct;
                var feature = null;
                var release = null;
                
                if ( !Ext.isEmpty(workproduct) && workproduct.Feature ) {
                    feature = workproduct.Feature;
                    product = feature.Project;
                }
                
                if ( !Ext.isEmpty(workproduct) && workproduct.Release ) {
                    release = workproduct.Release;
                }
                
                var task = time_value.get('TimeEntryItem').Task;
                if ( !Ext.isEmpty(task) ) {
                    if ( !Ext.isEmpty(task.c_ActivityType) && !/CapEx/.test(task.c_ActivityType) && !/^-/.test(task.c_ActivityType)) {
                        isOpEx = true;
                    }
                }
                
                if ( !Ext.isEmpty(workproduct)  ) {
                    if ( !Ext.isEmpty(workproduct.c_ActivityType) && !/CapEx/.test(workproduct.c_ActivityType) ) {
                        isOpEx = true;
                    }
                }
                
                if ( !Ext.isEmpty(feature) ) {
                    if ( !Ext.isEmpty(workproduct.c_ActivityType) && !/CapEx/.test(workproduct.c_ActivityType) ) {
                        isOpEx = true;
                    }
                }
                
                rows.push(Ext.Object.merge( time_value.getData(),{
                    WeekStartDate     : timesheet.get('WeekStartDate'),
                    User              : timesheet.get('User'),
                    __Location        : timesheet.get('User').OfficeLocation,
                    __AssociateID     : timesheet.get('User').NetworkID,
                    __EmployeeType    : timesheet.get('User').c_EmployeeType,
                    __CostCenter      : timesheet.get('User').CostCenter,
                    __Status          : timesheet.get('__Status'),
                    __LastUpdateBy    : timesheet.get('__LastUpdateBy'),
                    __LastUpdateDate  : timesheet.get('__LastUpdateDate'),
                    __Release         : release,
                    __Product         : product,
                    __IsOpEx          : isOpEx,
                    __WorkItem        : time_value.get('TimeEntryItem').WorkProduct,
                    __WorkItemDisplay : time_value.get('TimeEntryItem').WorkProductDisplayString,
                    __Task            : time_value.get('TimeEntryItem').Task,
                    __TaskDisplay     : time_value.get('TimeEntryItem').TaskDisplayString
                }));
                
            });
        });
                
        return Ext.Array.map(rows, function(row){
            return Ext.create('TSTimesheetFinanceRow',row);
        });
    },
    
    _getRowsFromChangesInTimesheets: function(timesheets) {
        var rows = [],
            me = this;
        var days = TSDateUtils.getDaysOfWeek();
        
        Ext.Object.each(timesheets, function(key,timesheet){
            var changes = timesheet.get('__TimeEntryChanges') || [];
            var week_start = timesheet.get('WeekStartDate');

            Ext.Array.each(changes, function(change){

                
                var change_type = change.__Appended ? "Appended" : "Amended";
                var isOpEx = false;
                
                var product = change.Project;
                var workproduct = change.WorkProduct;
                var feature = null;
                var release = null;
                
                if ( !Ext.isEmpty(workproduct) && workproduct.Feature ) {
                    feature = workproduct.Feature;
                    product = feature.Project;
                }
                
                if ( !Ext.isEmpty(workproduct) && workproduct.Release ) {
                    release = workproduct.Release;
                }
                
                var task = change.Task;
                if ( !Ext.isEmpty(task) ) {
                    if ( !Ext.isEmpty(task.c_ActivityType) && !/CapEx/.test(task.c_ActivityType) && !/^-/.test(task.c_ActivityType)) {
                        isOpEx = true;
                    }
                }
                
                if ( !Ext.isEmpty(workproduct)  ) {
                    if ( !Ext.isEmpty(workproduct.c_ActivityType) && !/CapEx/.test(workproduct.c_ActivityType) ) {
                        isOpEx = true;
                    }
                }
                
                if ( !Ext.isEmpty(feature) ) {
                    if ( !Ext.isEmpty(workproduct.c_ActivityType) && !/CapEx/.test(workproduct.c_ActivityType) ) {
                        isOpEx = true;
                    }
                }
                
                Ext.Array.each(days, function(day, idx){
                    var day_value = change['__' + day];
                    if (!Ext.isEmpty(day_value) && day_value !== 0 ) {
                        var day_date = Rally.util.DateTime.add(week_start, 'day', idx);
                        
                        rows.push({
                            __ChangeType      : change_type,
                            WeekStartDate     : timesheet.get('WeekStartDate'),
                            User              : timesheet.get('User'),
                            __Location        : timesheet.get('User').OfficeLocation,
                            __AssociateID     : timesheet.get('User').NetworkID,
                            __EmployeeType    : timesheet.get('User').c_EmployeeType,
                            __CostCenter      : timesheet.get('User').CostCenter,
                            __Status          : timesheet.get('__Status'),
                            __LastUpdateBy    : timesheet.get('__LastUpdateBy'),
                            __LastUpdateDate  : timesheet.get('__LastUpdateDate'),
                            DateVal           : day_date,
                            Hours             : day_value,
                            __Release         : release,
                            __Product         : product,
                            __IsOpEx          : isOpEx,
                            __WorkItem        : change.WorkProduct,
                            __WorkItemDisplay : change.WorkProduct.FormattedID + ": " + change.WorkProduct.Name,
                            __Task            : change.Task,
                            __TaskDisplay     : change.Task.FormattedID + ": " + change.Task.Name
                        });
                    }
                });
            });
            
        });
                
        return Ext.Array.map(rows, function(row){
            return Ext.create('TSTimesheetFinanceRow',row);
        });
    },
    
    _addGrid: function(container, timesheets) {

        
        this.rows = timesheets;
        
        var store = Ext.create('Rally.data.custom.Store',{
            data:timesheets,
            pageSize: 25,
            model: 'TSTimesheetFinanceRow'
        });
        
        var columns = this._getColumns();
        
        container.add({
            xtype:'rallygrid',
            store: store,
            columnCfgs: columns,
            enableEditing: false,
            showRowActionsColumn: false,
            enableBulkEdit: false,
            showPagingToolbar: true
        });
        
        this.setLoading(false);
    },
    
    _getColumns: function() {
        var columns = [];
        columns.push({dataIndex:'__ChangeType',text:' '});
        columns.push({
            dataIndex:'User',
            text:'User', 
            renderer: function(v) { 
                if ( Ext.isEmpty(v) ) {
                    return "";
                }
                return v._refObjectName; 
            }
        });
        columns.push({dataIndex:'__Location',text:'Location' });
        columns.push({dataIndex:'__AssociateID',text:'Associate ID' });
        columns.push({dataIndex:'__EmployeeType', text:'Employee Type' });
        columns.push({dataIndex:'__CostCenter', text:'Cost Center', exportRenderer: function(v) {
            return Ext.String.format('="{0}"', v);
        }});
        
        columns.push({dataIndex:'DateVal',text:'Work Date', align: 'center', renderer: function(v,m,r) {
            if ( Ext.isEmpty(v) ) {
                return "";
            }
            
            if ( Ext.isString(v) ) {
                return v;
            }
            return TSDateUtils.formatShiftedDate(v,'Y-m-d');
        }});
        
        columns.push({dataIndex:'Hours',  text:'Actual Hours', align: 'right'});
        columns.push({dataIndex:'__Status', text:'Status', align: 'center'});
        columns.push({dataIndex:'__LastUpdateBy', text:'Status Set By', align: 'center'});
        columns.push({dataIndex:'__LastUpdateDate', text:'Status Set On', align: 'center'});
        
        columns.push({dataIndex:'__WorkItemDisplay',text:'Work Item', align: 'center'});
        columns.push({dataIndex:'__Task',text:'Category', align: 'center', renderer: function(v) {
            if ( Ext.isEmpty(v) || Ext.isEmpty(v.c_ActivityType) ) { return ""; }
            return v.c_ActivityType;
        }});
        
        columns.push({dataIndex:'__Release',text:'Release', align: 'center', renderer: function(v) {
            if ( Ext.isEmpty(v) ) { return ""; }
            return v._refObjectName;
        }});
        
        columns.push({dataIndex:'__Release',text:'Release Status', align: 'center', renderer: function(v) {
            if ( Ext.isEmpty(v) || Ext.isEmpty(v.State) ) { return ""; }
            return v.State;
        }});
        columns.push({dataIndex:'__Release',text:'Decommission Date', align: 'center', renderer: function(v) {
            if ( Ext.isEmpty(v) || Ext.isEmpty(v.c_DecommissionDate) ) { return ""; }
            return v.c_DecommissionDate;
        }});
        columns.push({dataIndex:'__Release',text:'Deployment Date', align: 'center', renderer: function(v) {
            if ( Ext.isEmpty(v) || Ext.isEmpty(v.c_DeploymentDate) ) { return ""; }
            return v.c_DeploymentDate;
        }});
        
        columns.push({dataIndex:'__Product',text:'Product', align: 'center', renderer: function(v){ return v._refObjectName; }});
        columns.push({dataIndex:'__WorkItem',text:'Work Item Project', align: 'center', renderer: function(v) {
            if ( Ext.isEmpty(v) ) {
                return "";
            }
            
            return v.Project._refObjectName;
        }});
        
        columns.push({dataIndex: '__IsOpEx', text: 'OpEx', align: 'center'});
        
        columns.push({dataIndex: '___WeekNumber', text: 'Week Number', align: 'center'});
        
        return columns;
    },
    
    _getBeginningOfWeek: function(js_date){
        var start_of_week_here = Ext.Date.add(js_date, Ext.Date.DAY, -1 * js_date.getDay());
        return start_of_week_here;
    },
//    
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
    
    _export: function(){
        var me = this;

        this.setLoading("Generating CSV");
        
        var grid = this.down('rallygrid');
        var rows = this.rows;
                
        if ( !grid || !rows ) { return; }

        var filename = Ext.String.format('project-report.csv');


        
        Deft.Chain.sequence([
            function() { return Rally.technicalservices.FileUtilities.getCSVFromRows(this,grid,rows); } 
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
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){

        // Ext.apply(this, settings);
        this.launch();
    }
});
