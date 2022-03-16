describe("Example slow test", function() {
    var model;
    var ready_to_test;
    
    var app;
    
    beforeEach(function(){
        model = null;
        ready_to_test = false;
    });
    
    it("should have written tests",function(){
        var app = Rally.getApp();
        
        runs(function(){          
            Rally.data.ModelFactory.getModel({
                type: 'Iteration',
                //context: app.getContext(),
                success: function(result) {
                    
                    
                    model = result;
                    ready_to_test = true;
                },
                failure: function(msg) {
                    flag = true;
                    
                }
            });
        });
        
        waitsFor(function() {
            return ready_to_test;
        }, "Asynchronous call done");
        
        
        runs (function(){
            expect(model.getName()).toEqual('Iteration');    
        });
    });
    
    
    
});
