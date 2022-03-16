Ext.define('Rally.technicalservices.DeploymentFieldHistoryTab',{
    extend: 'Ext.panel.Panel',
    alias : 'widget.tsdeploymentfieldhistorytab',
    
    layout: 'border',
    
    deploy_field: 'c_IsDeployed',
    deploy_field_text: 'Is Deployed',
    
    initComponent: function() {
        this.callParent();
        this.add({
            xtype:'container',
            region: 'north',
            layout: 'hbox',
            items: [{
                xtype:'container',
                flex: 1
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
            this._loadHistories,
            this._loadReleases
        ],this).then({
            scope: this,
            success: function(results) {
                var revisions = results[0];
                var releases = results[1];
                
                var releases_by_revhistory_oid = {};
                
                Ext.Array.each(releases, function(release) {
                    var oid = release.get('RevisionHistory').ObjectID;

                    releases_by_revhistory_oid[oid] = release;
                });

                
                var rows = Ext.Array.map(revisions, function(revision) {
                    var rev_history_oid = revision.get('RevisionHistory').ObjectID;
                    
                    var release = releases_by_revhistory_oid[rev_history_oid];
                    if ( Ext.isEmpty(release) ) { return null; }
                    
                    return {
                        Description: revision.get('Description'),
                        Changer: revision.get('User')._refObjectName,
                        ChangeDate: revision.get('CreationDate'),
                        Release: release.get('Name'),
                        Project: release.get('Project').Name
                    };
                    
                });
                                
                var filtered_rows = Ext.Array.filter(rows, function(row) {
                    return !Ext.isEmpty(row);
                });
                
                var calculated_store = Ext.create('Rally.data.custom.Store',{
                    pageSize: 1000,
                    data: filtered_rows
                });
                me.down('rallygrid').bindStore(calculated_store);
                
                me.app.setLoading(false);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading', msg);
                me.app.setLoading(false);
            }
        });
    },
    
    _loadHistories: function() {
        this.app.setLoading("Loading revisions...");

        var start_date = this.app.start_date;
        var end_date = this.app.end_date;
        
        var filters = [
            {property:'Description',operator:'contains',value:this.deploy_field_text}
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
            model:'Revision',
            limit: 'Infinity',
            filters: filters,
            context: {
                project: null
            },
            fetch: ['Name','RevisionHistory','User','Description','CreationDate','ObjectID'],
            sorters: [{property:'CreationDate',direction:'DESC'}]
        };

        return TSUtilities.loadWsapiRecords(config);
    },
    
    _loadReleases: function(revisions) {
        this.app.setLoading('Loading releases...');
        
        var config = {
            model:'Release',
            limit:'Infinity',
            fetch: ['Name','Project','RevisionHistory','ObjectID']
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
        
        columns.push({dataIndex:'Release',text:'Release', flex: 1});
        columns.push({dataIndex:'Project', text: 'Project', flex: 1});
        columns.push({dataIndex:'Description',text:'Description', flex: 2});
        columns.push({dataIndex:'Changer',text:'Changed By'});
        columns.push({dataIndex:'ChangeDate',text:'Change Date', flex: 1});
        
        return columns;
    },
    
    _getStoreConfig: function() {
        return {
            data: [{ 
                Release: '',
                Changer: '',
                ChangeDate: '',
                Description: '',
                Project: ''
            }]
        }
    }
});