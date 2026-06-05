# CodeShield

### AI-Powered Coding Assessment Integrity Platform

CodeShield is a full-stack coding assessment platform designed to help organizations conduct fair and trustworthy programming evaluations in the age of AI-assisted coding.

Traditional plagiarism detectors often fail to identify sophisticated copying techniques, AI-generated solutions, proxy participation, and suspicious candidate behavior. CodeShield addresses these challenges through a combination of code similarity analysis, behavioral monitoring, and AI-generated code detection.

## Problem

Online coding assessments are becoming increasingly vulnerable to:

* AI-generated solutions from tools such as ChatGPT and Copilot
* Copy-paste plagiarism between candidates
* Structural code modifications designed to evade plagiarism checks
* Proxy candidates completing assessments on behalf of others
* Suspicious assessment behavior that traditional systems cannot detect

Existing solutions typically focus only on code similarity and miss behavioral indicators that reveal how the code was actually produced.

## Solution

CodeShield combines multiple detection techniques into a single platform that evaluates both the submitted code and the candidate's behavior during the assessment.

The platform provides:

* LeetCode-style coding assessments
* Real-time code editing environment
* Timed examinations
* Automatic code execution
* Plagiarism detection
* AI-generated code detection
* Candidate behavior analytics
* Administrative investigation dashboard

## Key Features

### Coding Assessment Platform

* Monaco Editor integration
* Timed coding examinations
* Multi-problem assessments
* Secure JWT authentication
* Role-based access control (Admin / Student)
* Automated code execution workflow

### Multi-Layer Plagiarism Detection

CodeShield uses multiple plagiarism detection techniques simultaneously:

#### TF-IDF Similarity

Measures semantic similarity between source code submissions.

#### N-Gram Analysis

Detects copied code fragments even after minor modifications.

#### AST Structural Analysis

Parses code into Abstract Syntax Trees and compares structural patterns rather than raw text, helping identify disguised plagiarism.

#### Weighted Similarity Scoring

Combines all plagiarism signals into a single similarity score for easier investigation.

### AI-Generated Code Detection

CodeShield analyzes coding behavior rather than relying solely on code content.

Behavioral signals include:

* Comment density analysis
* Variable naming genericity
* Typing speed consistency
* Typing burst detection
* Paste event frequency
* Editing behavior patterns
* Indentation consistency
* Submission timing characteristics

The system generates an AI-Likelihood Score (0-100%) indicating the probability that a solution was substantially AI-assisted.

### Administrative Analytics Dashboard

Administrators can:

* Monitor active assessments
* View plagiarism percentages
* Review AI-likelihood scores
* Compare submissions
* Flag suspicious candidates
* Analyze assessment statistics
* Access ranked candidate leaderboards

## System Architecture

Frontend:

* React
* Monaco Editor
* Tailwind CSS

Backend:

* FastAPI
* SQLAlchemy
* JWT Authentication
* WebSockets

Database:

* PostgreSQL

Machine Learning:

* scikit-learn
* XGBoost
* TF-IDF Vectorization

Deployment:

* Vercel (Frontend)
* Render (Backend)

## Database Design

* 15+ normalized PostgreSQL tables
* Optimized relational schema
* Assessment management
* User management
* Submission tracking
* Behavioral event logging
* Analytics storage

## Tech Stack

Frontend:

* React
* JavaScript
* Tailwind CSS
* Monaco Editor

Backend:

* FastAPI
* Python
* SQLAlchemy
* JWT
* WebSockets

Database:

* PostgreSQL

Machine Learning:

* scikit-learn
* XGBoost

Deployment:

* Render
* Vercel

## Impact

CodeShield moves beyond traditional plagiarism detection by combining source code analysis with behavioral intelligence.

The platform helps recruiters, universities, and coding assessment providers identify suspicious submissions more accurately while reducing false positives.

## Live Demo

https://codeshield-two.vercel.app/login

## Trial Test Demo Code

A sample trial test program showing standard rules and competitive programming I/O conventions can be found in [demo.txt](demo.txt). This includes reading inputs from standard input (`sys.stdin`) and printing results to standard output.

## Screenshots

* Student Dashboard
       <img width="1440" height="900" alt="Screenshot 2026-06-05 at 5 16 24 PM" src="https://github.com/user-attachments/assets/f0e398f2-1454-40f7-a101-6bec3e3abb7e" />
      <img width="1440" height="900" alt="Screenshot 2026-06-05 at 5 16 57 PM" src="https://github.com/user-attachments/assets/0fe6ac40-8adb-40fb-a8ed-ee90ca58dc48" />

* Coding Environment/ Assessment Page
     <img width="1440" height="900" alt="Screenshot 2026-06-05 at 5 17 25 PM" src="https://github.com/user-attachments/assets/72be7ccc-bef0-4873-87d3-dff1160318b6" />
  
* Admin Dashboard
     <img width="1440" height="900" alt="Screenshot 2026-06-05 at 5 18 18 PM" src="https://github.com/user-attachments/assets/09429ac7-403e-4a4a-878c-a44fb551b00c" />
     <img width="1440" height="900" alt="Screenshot 2026-06-05 at 5 18 35 PM" src="https://github.com/user-attachments/assets/0b51d196-0ffc-46e9-a49f-8b471e8b68ce" />

* Plagiarism Analysis View
     <img width="1440" height="900" alt="Screenshot 2026-06-05 at 5 19 41 PM" src="https://github.com/user-attachments/assets/f471a835-b9cb-4ad3-b989-c218f97823d6" />
     <img width="1440" height="900" alt="Screenshot 2026-06-05 at 5 19 25 PM" src="https://github.com/user-attachments/assets/1772b4ba-d2e3-4f78-a100-ab36a8c9d128" />
     <img width="1440" height="900" alt="Screenshot 2026-06-05 at 5 19 06 PM" src="https://github.com/user-attachments/assets/3ea93fb1-240c-4c80-8a45-66f4795347ab" />

* AI Detection Dashboard
      <img width="1440" height="900" alt="Screenshot 2026-06-05 at 5 20 05 PM" src="https://github.com/user-attachments/assets/6ad70ae2-ab7f-4db8-bfec-e44167de90b7" />
  

## Future Roadmap

* Webcam-based proctoring integration
* Browser activity monitoring
* LLM-specific detection models
* Real-time anomaly detection
* Organization-level analytics
* Multi-language plagiarism detection
* Enterprise assessment management
