# Task: Convert Project Rules to Claude Code Hooks

You are an expert at converting natural language project rules into Claude Code hook configurations.
Your task is to analyze the given rules and generate appropriate hook configurations following the
official Claude Code hooks specification.

## Instructions

1. If rules are provided as arguments, analyze those rules
2. If no arguments are provided, read and analyze the CLAUDE.md file from these locations:
   - `./CLAUDE.md` (project memory)
   - `./CLAUDE.local.md` (local project memory)
   - `~/.claude/CLAUDE.md` (user memory)

3. For each rule, determine:
   - The appropriate hook event (PreToolUse, PostToolUse, Stop, Notification, UserPromptSubmit,
     SubagentStop, PreCompact, SessionStart)
   - The tool matcher pattern (exact tool names or regex)
   - The command to execute

4. Generate the complete hook configuration following the exact JSON structure
5. Save it to the appropriate settings file (merge with existing hooks if present):
   - `~/.claude/settings.json` (User settings)
   - `.claude/settings.json` (Project settings)
   - `.claude/settings.local.json` (Local project settings)
6. Provide a summary of what was configured

## Hook Events

### PreToolUse

- **When**: Runs BEFORE a tool is executed
- **Common Keywords**: "before", "check", "validate", "prevent", "scan", "verify"
- **Available Tool Matchers**:
  - `Task` - Before launching agent tasks
  - `Bash` - Before running shell commands
  - `Glob` - Before file pattern matching
  - `Grep` - Before content searching
  - `Read` - Before reading files
  - `Edit` - Before editing single files
  - `MultiEdit` - Before batch editing files
  - `Write` - Before writing/creating files
  - `WebFetch` - Before fetching web content
  - `WebSearch` - Before web searching
  - MCP tools (pattern: `mcp__<server>__<tool>`)
- **Special Feature**: Can block tool execution if command returns non-zero exit code

### PostToolUse

- **When**: Runs AFTER a tool completes successfully
- **Common Keywords**: "after", "following", "once done", "when finished"
- **Available Tool Matchers**: Same as PreToolUse
- **Common Uses**: Formatting, linting, building, testing after file changes

### Stop

- **When**: Runs when Claude Code finishes responding
- **Common Keywords**: "finish", "complete", "end task", "done", "wrap up"
- **No matcher needed**: Applies to all completions
- **Common Uses**: Final status checks, summaries, cleanup

### Notification

- **When**: Runs when Claude Code sends notifications
- **Common Keywords**: "notify", "alert", "inform", "message"
- **Special**: Rarely used for rule conversion
- **Triggers**: When Claude needs permission or when input is idle for 60+ seconds

### UserPromptSubmit

- **When**: Runs when user submits a prompt, before Claude processes it
- **Common Keywords**: "before prompt", "validate input", "add context", "check prompt"
- **No matcher needed**: Applies to all user prompts
- **Common Uses**: Adding context, validating prompts, blocking certain types of prompts
- **Special**: Can add additional context or block prompt processing

### SubagentStop

- **When**: Runs when a Claude Code subagent (Task tool call) finishes responding
- **Common Keywords**: "subagent done", "task complete", "agent finished"
- **No matcher needed**: Applies to all subagent completions
- **Common Uses**: Cleanup after subagent tasks, status reporting

### PreCompact

- **When**: Runs before Claude Code compacts conversation history
- **Common Keywords**: "before compact", "cleanup before compress"
- **Available Matchers**:
  - `manual` - Invoked from `/compact` command
  - `auto` - Invoked automatically due to full context window
- **Common Uses**: Save important context before compression

### SessionStart

- **When**: Runs when Claude Code starts a new session or resumes existing one
- **Common Keywords**: "on startup", "session begin", "initialize"
- **Available Matchers**:
  - `startup` - Invoked from startup
  - `resume` - Invoked from `--resume`, `--continue`, or `/resume`
  - `clear` - Invoked from `/clear`
- **Common Uses**: Loading development context, setting up environment

## Hook Configuration Structure

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "ToolName|AnotherTool|Pattern.*",
        "hooks": [
          {
            "type": "command",
            "command": "your-command-here",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

For events without matchers (UserPromptSubmit, Stop, SubagentStop, Notification):

```json
{
  "hooks": {
    "EventName": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "your-command-here"
          }
        ]
      }
    ]
  }
}
```

## Matcher Patterns

- **Exact match**: `"Edit"` - matches only Edit tool
- **Multiple tools**: `"Edit|MultiEdit|Write"` - matches any of these
- **Regex patterns**: `".*Edit"` - matches Edit and MultiEdit
- **All tools**: Omit matcher field entirely or use `"*"` or `""`
- **MCP tools**: `"mcp__memory__.*"` (all memory server tools) or `"mcp__.*__write.*"` (all write
  operations)

## Examples with Analysis

### Example 1: Python Formatting

**Rule**: "Format Python files with black after editing" **Analysis**:

- Keyword "after" → PostToolUse
- "editing" → Edit|MultiEdit|Write tools
- "Python files" → command should target .py files

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "black . --quiet 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

### Example 2: Git Status Check

**Rule**: "Run git status when finishing a task" **Analysis**:

- "finishing" → Stop event
- No specific tool mentioned → no matcher needed

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "git status"
          }
        ]
      }
    ]
  }
}
```

### Example 3: Security Scan

**Rule**: "Check for hardcoded secrets before saving any file" **Analysis**:

- "before" → PreToolUse
- "saving any file" → Write|Edit|MultiEdit

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "git secrets --scan 2>/dev/null || echo 'No secrets found'"
          }
        ]
      }
    ]
  }
}
```

### Example 4: Test Runner

**Rule**: "Run npm test after modifying files in tests/ directory" **Analysis**:

- "after modifying" → PostToolUse
- "files" → Edit|MultiEdit|Write
- Note: Path filtering happens in the command, not the matcher

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npm test 2>/dev/null || echo 'Tests need attention'"
          }
        ]
      }
    ]
  }
}
```

### Example 5: Command Logging

**Rule**: "Log all bash commands before execution" **Analysis**:

- "before execution" → PreToolUse
- "bash commands" → Bash tool specifically

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"[$(date)] Executing bash command\" >> ~/.claude/command.log"
          }
        ]
      }
    ]
  }
}
```

### Example 6: Session Context Loading

**Rule**: "Load recent git changes when starting a new session" **Analysis**:

- "starting a new session" → SessionStart
- No specific matcher needed

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "git log --oneline -10 > /tmp/recent_changes.txt && echo 'Recent changes loaded'"
          }
        ]
      }
    ]
  }
}
```

### Example 7: Prompt Validation

**Rule**: "Check for sensitive information before processing user prompts" **Analysis**:

- "before processing" → UserPromptSubmit
- No matcher needed for prompt events

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/scripts/check-sensitive.py"
          }
        ]
      }
    ]
  }
}
```

## Hook Input and Output

### Hook Input

Hooks receive JSON data via stdin containing:

- `session_id`: Unique session identifier
- `transcript_path`: Path to conversation JSON file
- `cwd`: Current working directory
- `hook_event_name`: Name of the triggering event
- Event-specific fields (e.g., `tool_name`, `tool_input`, `prompt`)

### Hook Output Options

#### Simple: Exit Codes

- **Exit code 0**: Success, stdout shown to user (or added to context for
  UserPromptSubmit/SessionStart)
- **Exit code 2**: Blocking error, stderr fed back to Claude automatically
- **Other codes**: Non-blocking error, stderr shown to user

#### Advanced: JSON Output

For sophisticated control, output JSON to stdout:

```json
{
  "continue": true,
  "stopReason": "Optional message when continue is false",
  "suppressOutput": false,
  "decision": "block|approve|ask",
  "reason": "Explanation for decision",
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Context to add",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "Reason for permission decision"
  }
}
```

## Working with MCP Tools

MCP (Model Context Protocol) tools follow the pattern `mcp__<server>__<tool>`:

- `mcp__memory__create_entities` - Memory server's create entities tool
- `mcp__filesystem__read_file` - Filesystem server's read file tool
- `mcp__github__search_repositories` - GitHub server's search tool

Example MCP hook configuration:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__memory__.*",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Memory operation initiated' >> ~/mcp-operations.log"
          }
        ]
      }
    ]
  }
}
```

## Environment Variables

- `CLAUDE_PROJECT_DIR`: Absolute path to project root directory
- Use for project-specific scripts: `$CLAUDE_PROJECT_DIR/.claude/hooks/script.sh`

## Hook Execution Details

- **Timeout**: 60 seconds default (configurable per command)
- **Parallelization**: All matching hooks run in parallel
- **Environment**: Runs with Claude Code's environment and user permissions
- **Progress**: Shown in transcript mode (Ctrl-R) for PreToolUse/PostToolUse/Stop

## Best Practices for Command Generation

1. **Error Handling**: Add `|| true` or `2>/dev/null` to prevent hook failures from blocking Claude
2. **Quiet Mode**: Use quiet flags (--quiet, -q) when available
3. **Path Safety**: Use absolute paths with `$CLAUDE_PROJECT_DIR` for project scripts
4. **Performance**: Keep commands fast to avoid slowing down Claude (60s timeout)
5. **Logging**: Redirect verbose output to avoid cluttering Claude's interface
6. **Security**: Validate and sanitize inputs, avoid destructive operations
7. **Quoting**: Always quote shell variables: `"$VAR"` not `$VAR`

## Common Rule Patterns

- "Format [language] files after editing" → PostToolUse + Edit|MultiEdit|Write
- "Run [command] before committing" → PreToolUse + Bash (when git commit detected)
- "Check for [pattern] before saving" → PreToolUse + Write|Edit|MultiEdit
- "Execute [command] when done" → Stop event
- "Validate [something] before running commands" → PreToolUse + Bash
- "Clear cache after modifying config" → PostToolUse + Edit|MultiEdit|Write
- "Notify when [condition]" → Usually PostToolUse with specific matcher
- "Load context on startup" → SessionStart event
- "Validate user input" → UserPromptSubmit event
- "Cleanup after subagent tasks" → SubagentStop event
- "Save state before compact" → PreCompact event
- "Monitor MCP operations" → PreToolUse/PostToolUse + mcp\_\_.\*

## Important Notes

1. Always merge with existing hooks - don't overwrite
2. Test commands work before adding to hooks
3. Consider performance impact of hooks (60s timeout per command)
4. Use specific matchers when possible to avoid unnecessary executions
5. Commands run with full user permissions - be careful with destructive operations
6. Hook configuration changes don't take effect until Claude Code restart
7. Use `/hooks` command to verify hook registration
8. All matching hooks run in parallel
9. For debugging, use `claude --debug` to see hook execution details

## Configuration Safety

Direct edits to settings files don't take effect immediately. Claude Code:

1. Captures hook snapshot at startup
2. Uses snapshot throughout session
3. Warns if hooks are modified externally
4. Requires review in `/hooks` menu for changes to apply

## Security Considerations

**WARNING**: Hooks execute arbitrary shell commands with full user permissions. Always:

- Review and test commands before deployment
- Validate inputs to prevent injection attacks
- Use absolute paths for security
- Avoid modifying sensitive files
- Test in safe environments first

Anthropic provides no warranty for hook usage - use at your own risk.

## User Input

$ARGUMENTS
