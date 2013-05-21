/*
 * QtWebKit-powered headless test runner using PhantomJS
 *
 * PhantomJS binaries: http://phantomjs.org/download.html
 * Requires PhantomJS 1.6+ (1.7+ recommended)
 *
 * Run with:
 *   phantomjs runner.js [url-of-your-qunit-testsuite]
 *
 * e.g.
 *   phantomjs runner.js http://localhost/qunit/test/index.html
 */

/*global phantom:false, require:false, console:false, window:false, QUnit:false */

(function() {
	'use strict';

	var page, timeout,
		fs = require('fs'),
		args = require('system').args;
	
	// arg[0]: scriptName, args[1...]: arguments
	if (args.length < 2 || args.length > 3) {
		console.error('Usage:\n  phantomjs runner.js [url-of-your-qunit-testsuite] [timeout-in-seconds]');
		phantom.exit(1);
	}
	
	var url = args[1];
	
	page = require('webpage').create();
	if (args[2] !== undefined) {
		timeout = parseInt(args[2], 10);
	}

	// Route `console.log()` calls from within the Page context to the main Phantom context (i.e. current `this`)
	page.onConsoleMessage = function(msg) {
		console.log(msg);
	};

	page.onInitialized = function() {
		var addLogging = function() {
			window.document.addEventListener('DOMContentLoaded', function() {
				var testsPassed = 0,
					testsFailed = 0,
					module, moduleStart, testStart, testCases = [],
					current_test_assertions = [],
					junitxml = '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="testsuites">\n';
				QUnit.testStart(function() {
					testStart = new Date();
				});
	
				QUnit.moduleStart(function(context) {
					moduleStart = new Date();
					module = context.name;
					testCases = [];
				});
	
				QUnit.moduleDone(function(context) {
					// context = { name, failed, passed, total }
					var xml = '\t<testsuite name="' + context.name + '" errors="0" failures="' + context.failed + '" tests="' + context.total + '" time="' + (new Date() - moduleStart) / 1000 + '"';
					if (testCases.length) {
						xml += '>\n';
						for (var i = 0, l = testCases.length; i < l; i++) {
							xml += testCases[i];
						}
						xml += '\t</testsuite>\n';
					} else {
						xml += '/>\n';
					}
					junitxml += xml;
				});
	
				QUnit.testDone(function(result) {
					if (0 === result.failed) {
						testsPassed++;
					} else {
						testsFailed++;
					}
	
					console.log('\t' + result.name + ' completed - ' + (0 === result.failed ? 'PASS' : 'FAIL ***'));
					
					var xml = '\t\t<testcase classname="' + module + '" name="' + result.name + '" time="' + (new Date() - testStart) / 1000 + '"';
					if (result.failed) {
						xml += '>\n';
						for (var i = 0; i < current_test_assertions.length; i++) {
							xml += "\t\t\t" + current_test_assertions[i];
						}
						xml += '\t\t</testcase>\n';
					} else {
						xml += '/>\n';
					}
					current_test_assertions = [];
	
					testCases.push(xml);
	
				});
	
				QUnit.done(function(result) {
					console.log(testsPassed + ' of ' + (testsPassed + testsFailed) + ' tests successful.');
					console.log('==== TEST RUN COMPLETED - ' + (0 === testsFailed ? 'PASS' : 'FAIL') + '===');

					junitxml += '</testsuites>';
					
					if (typeof window.callPhantom === 'function') {
						window.callPhantom({
							'name':'QUnit.done',
							'data': result,
							'report': junitxml
						});
					}
				});
	
				QUnit.log = function(details) {
					//details = { result , actual, expected, message }
					if (details.result) {
						return;
					}
					var message = details.message || "";
					if (details.expected) {
						if (message) {
							message += ", ";
						}
						message = "expected: " + details.expected + ", but was: " + details.actual;
					}
					var xml = '<failure type="failed" message="' + details.message.replace(/ - \{((.|\n)*)\}/, "") + '"/>\n';
	
					current_test_assertions.push(xml);
				};
			}, false);
		};

		page.evaluate(addLogging);
	};

	page.onCallback = function(message) {
		var result,
			report,
			failed;

		if (message) {
			if (message.name === 'QUnit.done') {
				result = message.data;
				report = message.report;
				failed = !result || result.failed;


				var fileName = "../../../build/web-test-reports/" + url.replace(/\//g,'_').replace(/:/g,'_') + '.xml';
				fs.write(fileName, report, "w");

				
				phantom.exit(failed ? 1 : 0);
			}
		}
	};

	page.open(url, function(status) {
		if (status !== 'success') {
			console.error('Unable to access network: ' + status);
			phantom.exit(1);
		} else {
			// Cannot do this verification with the 'DOMContentLoaded' handler because it
			// will be too late to attach it if a page does not have any script tags.
			var qunitMissing = page.evaluate(function() { return (typeof QUnit === 'undefined' || !QUnit); });
			if (qunitMissing) {
				console.error('The `QUnit` object is not present on this page.');
				phantom.exit(1);
			}

			// Set a timeout on the test running, otherwise tests with async problems will hang forever
			if (typeof timeout === 'number') {
				setTimeout(function() {
					console.error('The specified timeout of ' + timeout + ' seconds has expired. Aborting...');
					phantom.exit(1);
				}, timeout * 1000);
			}

			// Do nothing... the callback mechanism will handle everything!	
		}
	});

})();