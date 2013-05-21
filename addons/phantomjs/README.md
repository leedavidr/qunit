# PhantomJS Runner #
A PhantomJS-powered headless test runner, providing JUnit XML report for QUnit tests.  This has a hardcoded build directory to generate the report to, but it can easily be modified to take in a system property.  This add-on was modified to workaround a reliability issue that we faced with the new grunt/qunit/phantomjs plugin.

### Usage ###
```bash
  phantomjs runner.js [url-of-your-qunit-testsuite] [timeout-in-seconds]
```

### Example ###
```bash
  phantomjs runner.js http://localhost/qunit/test/index.html
```

### Notes ###
 - Requires [PhantomJS](http://phantomjs.org/) 1.6+ (1.7+ recommended).
 - If you're using Grunt, you should take a look at its [qunit task](https://github.com/gruntjs/grunt-contrib-qunit).
 - JUnit report generation code forked from phantomjs-qunit-runner (https://code.google.com/p/phantomjs-qunit-runner/).
