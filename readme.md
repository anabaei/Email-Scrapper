# Email Scraper

A lightweight web scraping tool for finding and collecting publicly available email addresses from websites.

## Overview

Email Scraper is a small utility project that demonstrates how web content can be fetched, parsed, and searched for email addresses.

The goal is simple: provide a website, scan the publicly available page content, identify email addresses, and collect the results in a cleaner form.

## What It Does

The scraper is designed to:

* Read publicly accessible website content
* Detect email addresses found on a page
* Collect matching email addresses
* Reduce duplicate results
* Make the extracted data easier to review or reuse

## How It Works

At a high level, the process is:

1. Receive a website or page to scan.
2. Fetch the page content.
3. Inspect the returned HTML/text.
4. Find strings that match common email-address patterns.
5. Clean and collect the results.
6. Return the discovered email addresses.

```text
Website
   |
   v
Fetch Page
   |
   v
Parse Content
   |
   v
Find Email Addresses
   |
   v
Clean / Deduplicate
   |
   v
Results
```

## Why I Built It

This project was created as a practical exercise in web scraping and data extraction.

It demonstrates concepts such as:

* Working with HTTP requests
* Processing website content
* Extracting structured information from unstructured text
* Pattern matching
* Cleaning and filtering collected data

## Example Use Cases

This type of tool can be useful for:

* Finding publicly listed business contact information
* Researching company websites
* Building datasets from public web pages
* Learning how web scraping and text extraction work

## Responsible Use

This project is intended for learning and legitimate use with publicly available information.

When scraping websites:

* Respect the website's terms of service
* Respect `robots.txt` and rate limits where applicable
* Avoid collecting private or protected information
* Do not use collected addresses for spam or abusive messaging

## Project Status

This is a personal/learning project and may continue to evolve as new scraping, validation, and data-processing techniques are explored.

# Test Email

```javascript
bun run start
node send-email.js --test nabaei17@gmail.com
```
