# Manager View

Allows user `managers` and admins to view and approve timesheets created by the `User View` app.
A summary of all user's timesheet totals can be exported, or (by selecting an individual summary)
one or more detailed timesheets for each user can be exported.

## Limitations
* Manager edit of user timesheets is NOT SUPPORTED. Some of this functionality is in place but it
was not required for current customer and likely will not work.
* If the app is configured with a non-Sunday week start, timsheet export CSV data may contain
rows that have zero hours for every day. This is normal and reflects how the app has to work around
the Sunday week start used by the Agile Central data model.  It occurs when a user removes
a work item from their timesheet.

## Available Settings
* Show All - show all user timesheets to admins, regardless of the user manager
* Allow Edit - allow managers to edit user timesheets
* Preference Project - the shared project used to save timesheet data. Must be available to all
timesheet users.
* User Manager Field - field on the User object to use as the `manager`. The field can be a comma
separated list of login names. These users will be considered the manager of a user and will be allowed
to view those user's timesheets.
* Extra Portfolio Item Fields - Select one additional field from the PortfolioItem associated with
each timesheet entry to include that field data in the CSV output.
* Week starts on - Select the day of week that the timesheet week will start (Sunday default)

## Development Notes

* Approval status (and who/when) is saved in a preference where the key is
the week start and the user OID and the number of millisconds since 1970. 
(rally.technicalservices.timesheet.status.2016-01-03.1127100000033.1453440772000)
* A preference is saved for each approval/unapproval so that we can audit approvals
and re-openings.

## Test Plan
* State Filter
   * PASS - loads only timesheets in desired state
* Day picker
   * PASS - all days in week reset picker to start of week
   * PASS - default is prior month
* Row Actions
   * PASS - Empty for not submitted sheets
   * PASS - Approve submitted sheets
   * PASS - Unapprove approved sheets
   * PASS - Icon blank for not-submitted sheets
   * PASS - Icon gear for not-submitted sheets
   * PASS - Multiple sheet actions
* PASS - Extra PI field configurable
* PASS - Manager Edit of timesheets is configurable
* PASS - Manager Edit disabled hides add task/story/defect controls on timesheet details
* NOT TESTED - Amending / Appending Items
* PASS - Loading indicator after clicking "Go"
* PASS - CSV Export of all summary rows
* PASS - CSV Export of selected summary rows exports detailed timesheet
* PASS - CSV Export of timesheet (and includes extra field) (rows may have zero hours for items removed from timesheet)

### Timesheet popup
* PASS - State Changes:
   * PASS - Approve
   * PASS - Unapprove
* Add Items
   * NOT TESTED
* Remove Items
   * NOT TESTED
* PASS - Test with renamed PortfolioItem (e.g. Feature renamed "Epic")
* PASS - Column data
   * FAIL - Sort [can't sort Task State]
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
   * PASS - Week and Day Totals
* PASS - Days columns
   * PASS - Order matches configured start day of week
   * PASS - Weekends colored blue
   * PASS - Totals colored grey
   * NOT TESTED - 0-24 range, floating input only
   * NOT TESTED - Adjusting day adjusts day total
   * NOT TESTED - Adjusting day adjusts week total
   * PASS - Total red if <40
 * NOT TESTED - Data saving
   * Entered data shown on browser refesh
   * Entered data shown on change to different week and back
* PASS - Comments
   * PASS - Read comments
   * PASS - Add comments
* PASS - Start day of week configurable
* PASS - Non-Sunday Week Start
   * PASS -  starts show appropriate start dates
   * PASS - From/Through week pickers adjust to non-Sunday dates
   * PASS - Hours column totals correct
   * PASS - State changes work
   * PASS - Comments work

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
