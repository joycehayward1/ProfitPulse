#!/bin/bash
# Ralph - Long-running AI agent loop
# Usage: ./ralph.sh [max_iterations_per_story]
# Each user story gets up to max_iterations_per_story attempts to pass

set -e

MAX_ITERATIONS_PER_STORY=${1:-20}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

# Archive previous run if branch changed
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    DATE=$(date +%Y-%m-%d)
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"

    echo "Archiving previous run: $LAST_BRANCH"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "   Archived to: $ARCHIVE_FOLDER"

    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch
if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
fi

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Starting Ralph - Max iterations per story: $MAX_ITERATIONS_PER_STORY"
echo ""

# Get total number of stories
TOTAL_STORIES=$(jq '.userStories | length' "$PRD_FILE")
COMPLETED_STORIES=0
FAILED_STORIES=0
TOTAL_ITERATIONS=0

# Process each story
while true; do
  # Find the next story that hasn't passed
  NEXT_STORY=$(jq -r '.userStories | map(select(.passes == false)) | sort_by(.priority) | .[0].id // empty' "$PRD_FILE")

  if [ -z "$NEXT_STORY" ]; then
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  ALL STORIES COMPLETE!"
    echo "════════════════════════════════════════════════════════════"
    echo "  Total iterations: $TOTAL_ITERATIONS"
    echo "  Completed stories: $COMPLETED_STORIES"
    echo "  Failed stories: $FAILED_STORIES"
    echo ""
    exit 0
  fi

  STORY_TITLE=$(jq -r --arg id "$NEXT_STORY" '.userStories[] | select(.id == $id) | .title' "$PRD_FILE")

  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "  Working on: $NEXT_STORY - $STORY_TITLE"
  echo "  (up to $MAX_ITERATIONS_PER_STORY iterations)"
  echo "════════════════════════════════════════════════════════════"

  STORY_ITERATION=0
  STORY_PASSED=false

  while [ $STORY_ITERATION -lt $MAX_ITERATIONS_PER_STORY ]; do
    STORY_ITERATION=$((STORY_ITERATION + 1))
    TOTAL_ITERATIONS=$((TOTAL_ITERATIONS + 1))

    echo ""
    echo "───────────────────────────────────────────────────────────"
    echo "  $NEXT_STORY - Iteration $STORY_ITERATION of $MAX_ITERATIONS_PER_STORY"
    echo "───────────────────────────────────────────────────────────"

    # Run Claude on this story
    OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" | claude --dangerously-skip-permissions 2>&1 | tee /dev/stderr) || true

    # Check if the story passed
    STORY_STATUS=$(jq -r --arg id "$NEXT_STORY" '.userStories[] | select(.id == $id) | .passes' "$PRD_FILE")

    if [ "$STORY_STATUS" = "true" ]; then
      echo ""
      echo "  US-$NEXT_STORY PASSED on iteration $STORY_ITERATION"
      STORY_PASSED=true
      COMPLETED_STORIES=$((COMPLETED_STORIES + 1))
      break
    fi

    if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
      echo ""
      echo "  All stories complete!"
      exit 0
    fi

    echo "  Story not yet passing, continuing..."
    sleep 2
  done

  if [ "$STORY_PASSED" = "false" ]; then
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  $NEXT_STORY FAILED after $MAX_ITERATIONS_PER_STORY iterations"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "  Story: $STORY_TITLE"
    echo "  Attempts: $MAX_ITERATIONS_PER_STORY"
    echo ""
    echo "  Ralph needs your help to continue."
    echo "  Please review the story and either:"
    echo "    1. Fix the issue manually and re-run Ralph"
    echo "    2. Simplify the acceptance criteria in prd.json"
    echo "    3. Split this story into smaller stories"
    echo ""
    echo "  Progress so far: $COMPLETED_STORIES stories completed, $TOTAL_ITERATIONS total iterations"
    echo ""
    exit 1
  fi
done

echo ""
echo "Ralph finished."
echo "Total iterations: $TOTAL_ITERATIONS"
echo "Completed: $COMPLETED_STORIES, Failed: $FAILED_STORIES"
