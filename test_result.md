#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Session: Verified registration + account editing + guest gate (June 2026)
backend:
  - task: "Two-step verified registration (phone mandatory + email OTP)"
    file: "/app/backend/server.py"
    implemented: true
    needs_retesting: true
    status_history:
      - working: "NA"
        comment: "POST /api/auth/register/request-code (email,phone,password,name) sends 6-digit OTP via Emergent Resend; POST /api/auth/register/verify creates the user. Codes hashed (HMAC) in verification_codes with 10min TTL and 5-attempt limit."
  - task: "Change password / change email+phone with email OTP confirmation"
    file: "/app/backend/server.py"
    implemented: true
    needs_retesting: true
    status_history:
      - working: "NA"
        comment: "POST /api/users/me/password (current+new). POST /api/users/me/request-change-code {field} sends OTP to CURRENT email. POST /api/users/me/confirm-change {field,code} applies change. PATCH /api/users/me now accepts avatar."
  - task: "Guest answered_count in answer response"
    file: "/app/backend/server.py"
    implemented: true
    needs_retesting: true
    status_history:
      - working: "NA"
        comment: "POST /api/questions/{id}/answer returns answered_count (total answers for the user) for guest 5-question gating. public_user now returns is_guest, phone, email_verified."
frontend:
  - task: "Register UI with phone + OTP code step; settings account editing; guest gate modal"
    file: "/app/frontend/app/login.tsx, /app/frontend/app/settings.tsx, /app/frontend/app/(tabs)/index.tsx"
    implemented: true
    needs_retesting: false
    status_history:
      - working: "NA"
        comment: "Frontend only; smoke-tested via screenshot. Backend is the focus of this test run."
metadata:
  created_by: "main_agent"
test_plan:
  current_focus:
    - "Two-step verified registration (phone mandatory + email OTP)"
    - "Change password / change email+phone with email OTP confirmation"
    - "Guest answered_count in answer response"
  stuck_tasks: []
agent_communication:
  - agent: "main"
    message: "Please test NEW backend endpoints only. OTP codes are emailed (cannot read them in tests); verify validation/flow behavior: request-code returns ok for unused email and 409 for existing; verify with wrong code returns 400; password change requires correct current password (403 otherwise); request-change-code requires a real (non-guest) email and rejects taken emails with 409; answer endpoint returns answered_count. Do NOT attempt to read OTP codes from email. Existing login/guest/feed should still work."
