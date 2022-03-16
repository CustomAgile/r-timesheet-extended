# User View

An app to replace the Rally timesheet.

Manager can create append and amendments to existing timesheets.  When the user loads her current timesheet, 
the app will look back for appends/amends to past timesheets, check if each is an approved timesheet and if so will
absort the change.

For open timesheets, the user can choose to absort or remove the change.

## Available Settings
* Preference Project - the shared project used to save timesheet data. Must be available to all
timesheet users.
* Week starts on - Select the day of week that the timesheet week will start (Sunday default)

## Development Notes

* Caution: Locking of rows depends on a custom boolean field on Release called "c_IsDeployed"  (note the capital I)
* Override in the time grid in order to allow for variable selection of editor

* On absorb, the preference representing the append/amend will be saved with .~archived appended to the name.

## Test Plan
* PASS - Create a sheet for a new week
* PASS - Edit a sheet for an existing week
* PASS - State Changes:
   * PASS - Submit
   * PASS - Submitted data cannot be edited by user
   * PASS - Unsubmit
   * PASS - Approved
   * PASS - Unapproved
   * Processed
* PASS - Day picker
   * PASS - all days in week reset picker to start of week
* Add Items
   * PASS - defects
   * PASS - Add defect for story that already has a row
   * PASS - task from defect
   * PASS - story
   * PASS - task
   * PASS - Re-add defect, story or task that already exists
* PASS - Remove Items
   * PASS - Story, Defect, Task
   * PASS - Removing item decreemnts total
* PASS - View Comments
* PASS - Test with renamed PortfolioItem (e.g. Feature renamed "Epic")
* PASS - Set as default
   * PASS - defects
   * PASS - story
   * PASS - task
* PASS - "Add My Tasks" brings in default
   * PASS - defects
   * PASS - stories
   * PASS - tasks
* PASS - Column data
   * PASS - Sort
   * PASS - Columns can be added / removed
   * PASS - Columns selections persist across reloads
   * PASS - Feature shown for stories with feature
   * PASS - Feature blank for stories without feature
   * PASS - Feature shown for tasks on stories with feature
   * PASS - Feature blank for tasks on stories without feature
   * PASS - Work Product shown for all stories, defects and tasks
   * PASS - Work Product Estimate shown for all items with estimate
   * PASS - Work Product Schedule State
   * PASS - Task shown for tasks
   * PASS - Task Estimate
   * PASS - Task State
   * PASS - Release
   * PASS - Iteration
* PASS - Days columns
   * PASS - Order matches configured start day of week
   * PASS - Weekends colored blue
   * PASS - Totals colored grey
   * PASS - 0-24 range, floating input only
   * PASS - Adjusting day adjusts day total
   * PASS - Adjusting day adjusts week total
   * PASS - Total red if <40
* PASS - Data saving
   * PASS - Entered data shown on browser refesh
   * PASS - Entered data shown on change to different week and back
   * PASS - Add, Clear and Re-Add item
   * PASS - Clear and Re-Add existing item
* PASS - Comments
   * PASS - Read comments
   * PASS - Add comments
* PASS - Start day of week configurable
* Non-Sunday Week Start
   * No prior or next week sheet
       * PASS - Add item 
       * PASS - Add hours
       * PASS - Prior week timesheet has no visible entry for next week item
       * PASS - Next week timesheet has no visible entry for prev week item
       * PASS - Edit week hours don't affect prev or next week sheet
       * PASS - Submited timesheet no longer editable and doesn't affect next or prior weeks
       * PASS - Clear and Remove hours don't affect prev or next week sheet
       * PASS - Re-add after Clear and Remove without changing weeks
   * Next week exists
       * PASS - Add same item as next week
       * PASS - Add different item as next week
       * PASS - Add hours
       * PASS - Prior week timesheet has no visible entry for next week item
       * PASS - week timesheet has no visible entry for prev week item
       * PASS - Edit week hours don't affect prev or next week sheet
       * PASS - Submited timesheet no longer editable and doesn't affect next or prior weeks
       * PASS -  and Remove hours don't affect prev or next week sheet
       * PASS - Re-add after Clear and Remove without changing weeks
  * Prior week exists
       * PASS - Add same item as prior week
       * PASS - Add different item as prior week
       * PASS - Add hours
       * PASS - Prior week timesheet has no visible entry for next week item
       * PASS - Next week timesheet has no visible entry for prev week item
       * PASS - Edit week hours don't affect prev or next week sheet
       * PASS -  timesheet no longer editable and doesn't affect next or prior weeks
       * PASS - Clear and Remove hours don't affect prev or next week sheet
       * PASS - Re-add after Clear and Remove without changing weeks
   * Prev and Next week exist
       * PASS - Add same item as prior and next week
       * PASS - Add different item as prior and next week
       * PASS - Add hours
       * PASS - Prior week timesheet has no visible entry for next week item
       * PASS - Next week timesheet has no visible entry for prev week item
       * PASS - Edit week hours don't affect prev or next week sheet
       * PASS - Submited timesheet no longer editable and doesn't affect next or prior weeks
       * PASS - Clear and Remove hours don't affect prev or next week sheet
       * PASS - Re-add after Clear and Remove without changing weeks

### First Load

If you've just downloaded this from github and you want to do development, 
you're going to need to have these installed:

 * node.js
 * grunt-cli
 * grunt-init
 
Since you're getting this from github, we assume you have the command line
version of git also installed.  If not, go get git.

If you have those three installed, just type this in the root directory here
to get set up to develop:

  npm install

### Structure

  * src/javascript:  All the JS files saved here will be compiled into the 
  target html file
  * src/style: All of the stylesheets saved here will be compiled into the 
  target html file
  * test/fast: Fast jasmine tests go here.  There should also be a helper 
  file that is loaded first for creating mocks and doing other shortcuts
  (fastHelper.js) **Tests should be in a file named <something>-spec.js**
  * test/slow: Slow jasmine tests go here.  There should also be a helper
  file that is loaded first for creating mocks and doing other shortcuts 
  (slowHelper.js) **Tests should be in a file named <something>-spec.js**
  * templates: This is where templates that are used to create the production
  and debug html files live.  The advantage of using these templates is that
  you can configure the behavior of the html around the JS.
  * config.json: This file contains the configuration settings necessary to
  create the debug and production html files.  Server is only used for debug,
  name, className and sdk are used for both.
  * package.json: This file lists the dependencies for grunt
  * auth.json: This file should NOT be checked in.  Create this to run the
  slow test specs.  It should look like:
    {
        "username":"you@company.com",
        "password":"secret"
    }
  
### Usage of the grunt file
####Tasks
    
##### grunt debug

Use grunt debug to create the debug html file.  You only need to run this when you have added new files to
the src directories.

##### grunt build

Use grunt build to create the production html file.  We still have to copy the html file to a panel to test.

##### grunt test-fast

Use grunt test-fast to run the Jasmine tests in the fast directory.  Typically, the tests in the fast 
directory are more pure unit tests and do not need to connect to Rally.

##### grunt test-slow

Use grunt test-slow to run the Jasmine tests in the slow directory.  Typically, the tests in the slow
directory are more like integration tests in that they require connecting to Rally and interacting with
data.
