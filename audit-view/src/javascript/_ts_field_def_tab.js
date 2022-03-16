Ext.define('Rally.technicalservices.FieldDefinitionHistoryTab',{
    extend: 'Ext.panel.Panel',
    alias : 'widget.tsfielddeftab',
    
    layout: 'border',

    initComponent: function() {
        this.callParent();
        
        this.add({ 
            xtype:'container',
            region: 'center',
            layout: 'fit',
            items: [ this._getGridConfig()]
        });
    },
    
    updateContent: function(app) {
        this.app = app;
        var me = this;
        
        Deft.Chain.sequence([
            this._loadRevisions
        ],this).then({
            success: function(results) {
                var revisions = results[0];
                
                
                var rows = Ext.Array.map(revisions, function(revision){

                    return {
                        Change: revision.get('Description'),
                        Changer: revision.get('User')._refObjectName,
                        ChangeDate: revision.get('CreationDate')
                    };
                });
                                
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
    
    _loadRevisions: function() {
        this.app.setLoading("Loading history...");

        var deferred = Ext.create('Deft.Deferred');
        
        var start_date = this.app.start_date;
        var end_date = this.app.end_date;
        
        var workspace_oid = this.app.getContext().getWorkspace().ObjectID;
        TSUtilities.loadWsapiRecords({
            model:'Workspace',
            filters: [{property:'ObjectID',value: workspace_oid}],
            fetch:['RevisionHistory','ObjectID']
        }).then({
            scope: this,
            success: function(workspaces) {
                var revision_history_oid = workspaces[0].get('RevisionHistory').ObjectID;
                
                var filters = [
                    {property:'RevisionHistory',value:'revisionhistory/' + revision_history_oid},
                    {property:'Description', operator:'contains', value:'[ACTIVITY' },
                    {property:'CreationDate', operator: '>=', value: start_date },
                    {property:'CreationDate', operator: '<=', value: end_date }
                ];
                
                var config = {
                    model:'Revision',
                    limit: 'Infinity',
                    context: {
                        project: null
                    },
                    filters: filters,
                    fetch: ['Description','User','CreationDate','UserName'],
                    sorters: [{property:'CreationDate',direction:'DESC'}]
                };
                
                TSUtilities.loadWsapiRecords(config).then({
                    success: function(results) {
                        deferred.resolve(results);
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
        
        columns.push({dataIndex:'Changer',text:'Changed By'});
        columns.push({dataIndex:'ChangeDate',text:'Change Date'});
        columns.push({dataIndex:'Change',text:'Change', flex: 1});

        return columns;
    },
    
    _getStoreConfig: function() {
        return {
            data: [{ 
                Change: '',
                Changer: '',
                ChangeDate: ''
            }]
        }
    }
});