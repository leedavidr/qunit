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
	var escapedUrl = url.replace(/\//g,'_').replace(/:/g,'_') + '.xml';
	var fileName = "../../../build/web-test-reports/" + escapedUrl;

	console.log("==================================================================================\nSTARTING TESTS FOR - " + url);
	page = require('webpage').create();
	if (args[2] !== undefined) {
		timeout = parseInt(args[2], 10);
		console.log('timeout set to ' + timeout);
	}
	console.log("==================================================================================\n\n");

	page.onConsoleMessage = function(msg, lineNum, sourceId) {
		console.log("> " + msg);
		if (typeof lineNum !== 'undefined') {
			console.log('-- line #' + lineNum);
		}
		if (typeof sourceId !== 'undefined') {
			console.log('-- sourceId: ' + sourceId);
		}
	};

	page.onError = function(msg, trace) {
    		var msgStack = ['ERROR: ' + msg];
	    	if (trace && trace.length) {
	        	msgStack.push('TRACE:');
	    	    trace.forEach(function(t) {
        		    msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
	        	});
   			}
	    	console.error(msgStack.join('\n'));
	};
	
	page.onResourceError = function(resourceError) {
    		console.log('Unable to load resource (URL:' + resourceError.url + ')');
    		console.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
	};

	page.onInitialized = function() {
		var addLogging = function() {
			window.document.addEventListener('DOMContentLoaded', function() {
				QUnit.testStart(function(details) {
					if (typeof window.callPhantom === 'function') {
						window.callPhantom({
							'name':'QUnit.testStart',
							'details': details,
							'testStart': new Date()
						});
					}
				});
	
				QUnit.moduleStart(function(context) {
					if (typeof window.callPhantom === 'function') {
						window.callPhantom({
							'name':'QUnit.moduleStart',
							'moduleStart': new Date(),
							'module': context.name
						});
					}
				});
	
				QUnit.moduleDone(function(context) {
					if (typeof window.callPhantom === 'function') {
						window.callPhantom({
							'name':'QUnit.moduleDone',
							'context': context,
							'now': new Date() 
						});
					}
				});
	
				QUnit.testDone(function(result) {
					if (typeof window.callPhantom === 'function') {
						window.callPhantom({
							'name':'QUnit.testDone',
							'result': result,
							'now': new Date()
						});
					}
				});
	
				QUnit.done(function(result) {
					if (typeof window.callPhantom === 'function') {
						window.callPhantom({
							'name':'QUnit.done',
							'data': result
						});
					}
				});
	
				QUnit.log = function(details) {
					if (details.result) {
						return;
					}
					
					if (typeof window.callPhantom === 'function') {
						window.callPhantom({
							'name':'QUnit.log',
							'details': details
						});
					}
				};
			}, false);
		};

		page.evaluate(addLogging);
	};

	var escapeXml = function(value) {
		var escapedValue = value.replace(/&/g, '&amp;')
        						.replace(/</g, '&lt;')
        						.replace(/>/g, '&gt;')
        						.replace(/"/g, '&quot;');
		return escapedValue;
	}

	var testsPassed = 0,
		testsFailed = 0,
		suiteStart = new Date(), module, moduleStart, testStart, testCases = [],
		current_test_assertions = [],
		junitxml = '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="testsuites">\n';
	
	page.onCallback = function(message) {	
		if (message) {
			if (message.name === 'QUnit.moduleStart') {
				testCases = [];
				module = escapeXml(message.module);
				moduleStart = message.moduleStart;
			} else if (message.name === 'QUnit.testStart') {
				testStart = message.testStart;

				console.log('\t' + message.details.module + ' - ' + message.details.name + ' running... ');
			} else if (message.name === 'QUnit.log') {
				var detailsMessage = message.details.message || "";
				if (message.details.expected) {
					if (detailsMessage) {
						detailsMessage += ", ";
					}
					detailsMessage = "expected: " + message.details.expected + ", but was: " + message.details.actual;
				}
				var xml = '<failure type="failed" message="' + escapeXml(detailsMessage.replace(/ - \{((.|\n)*)\}/, "")) + '"/>\n';

				current_test_assertions.push(xml);
			} else if (message.name === 'QUnit.testDone') {
				if (0 === message.result.failed) {
					testsPassed++;
				} else {
					testsFailed++;
				}

				var timeInSeconds = (message.now - testStart) / 1000.0;
				console.log('\t' + message.result.module + ' - ' + message.result.name + ' - Duration: ' + timeInSeconds + ' seconds - ' + (0 === message.result.failed ? 'PASSED' : 'FAILED *********************'));

				if (timeInSeconds > 10) {
					console.log('WARNING: LONG RUNNING TEST');
				}
				
				var xml = '\t\t<testcase classname="' + escapedUrl + '" name="' + escapeXml(message.result.name) + '" time="' + timeInSeconds + '"';
				if (message.result.failed) {
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
			} else if (message.name === 'QUnit.moduleDone') {
				var xml = '\t<testsuite name="' + escapedUrl + '" errors="0" failures="' + message.context.failed + '" tests="' + message.context.total + '" time="' + (message.now - moduleStart) / 1000 + '"';
				
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
			} else if (message.name === 'QUnit.done') {
				console.log(testsPassed + ' of ' + (testsPassed + testsFailed) + ' tests successful.');
				console.log('Duration: ' + (new Date() - suiteStart) / 1000 + ' seconds');
				console.log('==== TEST RUN COMPLETED - ' + (0 === testsFailed ? 'SUCCESSFUL' : 'FAILURE') + '\n\n');
				
				var result = message.data,
					failed = !result || result.failed;

				junitxml += '</testsuites>';
				
				fs.write(fileName, junitxml, "w");
				
				phantom.exit(failed ? 1 : 0);
			}
		}
	};

	page.onAlert = function(msg) {
	    	console.log('ALERT MESSAGE RECEIVED: ' + msg);
	};
	
	page.onClosing = function(closingPage) {
    		console.log('CLOSING URL: ' + closingPage.url);
	};

	page.open(url, function(status) {
		if (status !== 'success') {
			console.error('Unable to access network: ' + status);
			
			var report = '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="testsuites">\n<testsuite name="' + escapedUrl + '" errors="1" failures="0" tests="1" time="1">\n<testcase classname="' + escapedUrl + '" name="Test Suite Error" time="1">\n<error type="Network Error" message="Web application is not accessible."/>\n</testcase>\n</testsuite>\n</testsuites>';
			fs.write(fileName, report, "w");
			
			phantom.exit(1);
		} else {
			// Cannot do this verification with the 'DOMContentLoaded' handler because it
			// will be too late to attach it if a page does not have any script tags.
			var qunitMissing = page.evaluate(function() { return (typeof QUnit === 'undefined' || !QUnit); });
			if (qunitMissing) {
				console.error('The `QUnit` object is not present on this page.');
				
				var report = '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="testsuites">\n<testsuite name="' + escapedUrl + '" errors="1" failures="0" tests="1" time="1">\n<testcase classname="' + escapedUrl + '" name="Test Suite Error" time="1">\n<error type="QUnit application" message="Web application does not have a QUnit object.  Check whether the URL is pointed to a QUnit test."/>\n</testcase>\n</testsuite>\n</testsuites>';
				fs.write(fileName, report, "w");
				
				phantom.exit(1);
			}

			// Set a timeout on the test running, otherwise tests with async problems will hang forever
			if (typeof timeout === 'number') {
				setTimeout(function() {
					console.error('The specified timeout of ' + timeout + ' seconds has expired. Aborting...');
					var report = '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="testsuites">\n<testsuite name="' + escapedUrl + '" errors="1" failures="0" tests="1" time="' + timeout + '">\n<testcase classname="' + escapedUrl + '" name="Test Suite Timed Out" time="' + timeout + '">\n<error type="Time Out Error" message="See console logs for details"/>\n</testcase>\n</testsuite>\n</testsuites>';
					fs.write(fileName, report, "w");
					phantom.exit(1);
				}, timeout * 1000);
			}

			// Do nothing... the callback mechanism will handle everything!	
		}
	});

})();
