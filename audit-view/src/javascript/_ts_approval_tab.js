Ext.define('Rally.technicalservices.ApprovalHistoryTab',{
    extend: 'Ext.panel.Panel',
    alias : 'widget.tsapprovalhistorytab',
    
    layout: 'border',

    _approvalKeyPrefix: 'rally.technicalservices.timesheet.status',
    
    initComponent: function() {
        this.callParent();
        this.add({
            xtype:'container',
            region: 'north',
            layout: 'hbox',
            items: [{
                xtype:'container',
                flex: 1
            },
            {
                xtype:'rallycheckboxfield',
                itemId: 'status_date_check',
                fieldLabel: 'Tick this box to apply date range to status date instead of timesheet date',
                width: 405,
                labelWidth: 385,
                align: 'right',
                margin: '0 5 0 0',
                listeners: {
                    scope: this,
                    change: this._updateIfReady
                }
            }]
        });
        this.add({ 
            xtype:'container',
            region: 'center',
            layout: 'fit',
            items: [ this._getGridConfig()]
        });
    },
    
    _updateIfReady: function() {
        if ( !Ext.isEmpty(this.app) && !Ext.isEmpty(this.app.start_date) && !Ext.isEmpty(this.app.end_date) ) {
            this.updateContent(this.app);
        }
    },
    
    updateContent: function(app) {
        this.app = app;
        var me = this;
        
        Deft.Chain.sequence([
            this._loadPreferences,
            this._loadUsers
        ],this).then({
            success: function(results) {
                var preferences = results[0];
                var users = results[1];
                
                var users_by_oid = {};
                Ext.Array.each(users, function(user) {
                    users_by_oid[user.get('ObjectID')] = user;
                });
                
                var rows = Ext.Array.map(preferences, function(preference){
                    var value = preference.get('Value');
                    var status_object = Ext.JSON.decode(value);
                    var name_array = preference.get('Name').split('.');
                    
                    var week_start = name_array[4];
                    var user_oid = name_array[5];
                    
                    return {
                        WeekStartDate: week_start,
                        Status: status_object.status,
                        Changer: status_object.status_owner._refObjectName,
                        ChangeDate: preference.get('CreationDate'),
                        User: users_by_oid[user_oid] || "unavailable"
                    };
                });
                
                rows = me._filterByWeekStart(rows);
                
                var calculated_store = Ext.create('Rally.data.custom.Store',{
                    pageSize: 1000,
                    data: rows
                });
                me.down('rallygrid').bindStore(calculated_store);
                me.app.setLoading(false);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading', msg);
            }
        });
    },
    
    _loadPreferences: function() {
        this.app.setLoading("Loading statuses...");

        var start_date = this.app.start_date;
        var end_date = this.app.end_date;
        
        var filters = [
            {property:'Name',operator:'contains',value:this._approvalKeyPrefix}
        ];
        
        if (this.down('#status_date_check') && this.down('#status_date_check').getValue() == true ) { 
            Ext.Array.push( filters, [
                {property:'CreationDate', operator: '>=', value: start_date },
                {property:'CreationDate', operator: '<=', value: end_date }
            ]);
        } else {
            Ext.Array.push(filters, [{ property:'CreationDate', operator:'>=', value: start_date}]);
        }

        var config = {
            model:'Preference',
            limit: 'Infinity',
            filters: filters,
            fetch: ['Name','Value','CreationDate'],
            sorters: [{property:'CreationDate',direction:'DESC'}]
        };

        return TSUtilities.loadWsapiRecords(config);
    },
    
    _loadUsers: function() {
        this.app.setLoading("Loading users...");

        var filters = [{property:'ObjectID',operator:'>',value:-1}];
        var config = {
            model:'User',
            limit: 'Infinity',
            filters: filters,
            fetch: ['UserName','DisplayName','ObjectID']
        };

        return TSUtilities.loadWsapiRecords(config);
    },
    
    _filterByWeekStart: function(rows) {
        var filtered_rows = [];
        if (this.down('#status_date_check') && this.down('#status_date_check').getValue() == true ) { 
            // already filtered properly (can't filter via api query on dates of week start/end
            return rows;
        }
        
        var start_date = this.app.start_date.replace(/T.*$/,'');
        var end_date = this.app.end_date.replace(/T.*$/,'');
        
        return Ext.Array.filter(rows, function(row){
            var week_start = row.WeekStartDate;
            return ( week_start >= start_date && week_start <= end_date );
            return true;
        });
        
    },
    
    _getGridConfig: function() {
        return {
            xtype                : 'rallygrid',
            sortableColumns      : false,
            showRowActionsColumn : false,
            showPagingToolbar    : false,
            columnCfgs           : this._getColumns(),
            store                : Ext.create('Rally.data.custom.Store', this._getStoreConfig())
        }
    },
    
    _getColumns: function() {
        var columns = [];
        
        columns.push({dataIndex:'User',text:'User', renderer: function(v) {
            if ( Ext.isString(v) ) { return v; }
            return v.get('DisplayName') || v.get('UserName');
        }});
        columns.push({dataIndex:'WeekStartDate',text:'Week Start'});
        columns.push({dataIndex:'Status',text:'Status'});
        columns.push({dataIndex:'Changer',text:'Changed By'});
        columns.push({dataIndex:'ChangeDate',text:'Change Date', flex: 1});
        
        return columns;
    },
    
    _getStoreConfig: function() {
        return {
            data: [{ 
                Status: '',
                Changer: '',
                ChangeDate: '',
                User: '',
                WeekStartDate: ''
            }]
        }
    }
});