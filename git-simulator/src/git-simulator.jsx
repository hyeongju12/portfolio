import { useState, useRef, useEffect, useCallback } from "react";

const COLORS = {
  bg: "#0a0e17",
  panel: "#0f1420",
  border: "#1a2235",
  termBg: "#080c14",
  text: "#c8d6e5",
  textDim: "#5a6a80",
  accent: "#00e5a0",
  accentDim: "#00e5a033",
  branch: "#ff6b6b",
  branchAlt: "#ffd93d",
  branchThird: "#6c5ce7",
  merge: "#00b4d8",
  staged: "#ffd93d",
  modified: "#ff6b6b",
  untracked: "#5a6a80",
  committed: "#00e5a0",
};

const FONT = `'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace`;

const INITIAL_STATE = {
  workingDir: [
    { name: "index.html", status: "untracked" },
    { name: "style.css", status: "untracked" },
  ],
  stagingArea: [],
  commits: [],
  branches: [{ name: "main", commitIdx: -1 }],
  currentBranch: "main",
  HEAD: "main",
  log: [],
  stash: [],
  remoteCommits: [],
};

const TUTORIALS = [
  {
    title: "기초: 파일 추적하기",
    steps: [
      { cmd: "git status", desc: "현재 작업 디렉토리 상태를 확인합니다" },
      { cmd: "git add index.html", desc: "index.html을 Staging Area에 추가합니다" },
      { cmd: "git add style.css", desc: "style.css도 Staging Area에 추가합니다" },
      { cmd: 'git commit -m "Initial commit"', desc: "Staging Area의 파일들을 커밋합니다" },
    ],
  },
  {
    title: "브랜치 다루기",
    steps: [
      { cmd: "touch app.js", desc: "새 파일을 생성합니다" },
      { cmd: "git add app.js", desc: "새 파일을 스테이징합니다" },
      { cmd: 'git commit -m "Add app.js"', desc: "커밋합니다" },
      { cmd: "git branch feature", desc: "feature 브랜치를 생성합니다" },
      { cmd: "git checkout feature", desc: "feature 브랜치로 전환합니다" },
      { cmd: "touch utils.js", desc: "feature 브랜치에서 새 파일 생성" },
      { cmd: "git add utils.js", desc: "스테이징합니다" },
      { cmd: 'git commit -m "Add utils"', desc: "feature 브랜치에 커밋합니다" },
    ],
  },
  {
    title: "병합(Merge)",
    steps: [
      { cmd: "git checkout main", desc: "main 브랜치로 돌아갑니다" },
      { cmd: "git merge feature", desc: "feature 브랜치를 main에 병합합니다" },
    ],
  },
];

const HELP_TEXT = `사용 가능한 명령어:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  git init          저장소 초기화
  git status        상태 확인
  git add <file>    파일 스테이징 (. 으로 전체)
  git commit -m ""  커밋 생성
  git log           커밋 히스토리
  git branch        브랜치 목록
  git branch <name> 브랜치 생성
  git checkout <b>  브랜치 전환
  git merge <b>     브랜치 병합
  git stash         변경사항 임시 저장
  git stash pop     임시 저장 복원
  git diff          변경사항 비교
  git reset         스테이징 취소
  touch <file>      새 파일 생성
  echo "t" > <file> 파일 수정
  rm <file>         파일 삭제
  clear             터미널 정리
  help              도움말
  reset-all         시뮬레이터 초기화`;

function generateId() {
  return Math.random().toString(16).slice(2, 9);
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(7, "0").slice(0, 7);
}

export default function GitSimulator() {
  const [state, setState] = useState(JSON.parse(JSON.stringify(INITIAL_STATE)));
  const [termLines, setTermLines] = useState([
    { type: "system", text: "Git Learning Simulator v1.0" },
    { type: "system", text: '환영합니다! "help"를 입력하거나 우측 튜토리얼을 따라해보세요.' },
    { type: "system", text: "" },
  ]);
  const [input, setInput] = useState("");
  const [tutorialIdx, setTutorialIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [animatingNode, setAnimatingNode] = useState(null);
  const [activeTab, setActiveTab] = useState("visual");
  const termRef = useRef(null);
  const inputRef = useRef(null);
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [termLines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = useCallback((lines) => {
    setTermLines((prev) => [...prev, ...(Array.isArray(lines) ? lines : [lines])]);
  }, []);

  const processCommand = useCallback(
    (rawCmd) => {
      const cmd = rawCmd.trim();
      if (!cmd) return;

      const s = JSON.parse(JSON.stringify(state));
      const output = [];

      const prompt = { type: "input", text: cmd };
      const parts = cmd.split(/\s+/);

      if (cmd === "clear") {
        setTermLines([]);
        setState(s);
        return;
      }

      if (cmd === "reset-all") {
        setState(JSON.parse(JSON.stringify(INITIAL_STATE)));
        setTermLines([
          { type: "system", text: "시뮬레이터가 초기화되었습니다." },
        ]);
        setTutorialIdx(0);
        setStepIdx(0);
        return;
      }

      if (cmd === "help") {
        addLine([prompt, { type: "info", text: HELP_TEXT }]);
        setState(s);
        return;
      }

      // touch <file>
      if (parts[0] === "touch" && parts[1]) {
        const fname = parts[1];
        const exists =
          s.workingDir.find((f) => f.name === fname) ||
          s.stagingArea.find((f) => f.name === fname);
        if (exists) {
          output.push({ type: "error", text: `'${fname}' 파일이 이미 존재합니다.` });
        } else {
          s.workingDir.push({ name: fname, status: "untracked" });
          output.push({ type: "success", text: `새 파일 '${fname}' 생성됨` });
        }
      }

      // echo > file (modify)
      else if (parts[0] === "echo") {
        const gtIdx = parts.indexOf(">");
        if (gtIdx > 0 && parts[gtIdx + 1]) {
          const fname = parts[gtIdx + 1];
          const inWork = s.workingDir.find((f) => f.name === fname);
          const inStage = s.stagingArea.find((f) => f.name === fname);
          const committed = s.commits.length > 0 &&
            s.commits.some((c) => c.files.some((f) => f.name === fname));
          if (inWork) {
            inWork.status = "modified";
            output.push({ type: "success", text: `'${fname}' 수정됨` });
          } else if (inStage || committed) {
            s.workingDir.push({ name: fname, status: "modified" });
            output.push({ type: "success", text: `'${fname}' 수정됨 (Working Directory에 변경사항 표시)` });
          } else {
            s.workingDir.push({ name: fname, status: "untracked" });
            output.push({ type: "success", text: `새 파일 '${fname}' 생성됨` });
          }
        } else {
          output.push({ type: "error", text: '사용법: echo "내용" > filename' });
        }
      }

      // rm <file>
      else if (parts[0] === "rm" && parts[1]) {
        const fname = parts[1];
        const wIdx = s.workingDir.findIndex((f) => f.name === fname);
        if (wIdx >= 0) {
          s.workingDir.splice(wIdx, 1);
          output.push({ type: "success", text: `'${fname}' 삭제됨` });
        } else {
          output.push({ type: "error", text: `'${fname}' 파일을 찾을 수 없습니다.` });
        }
      }

      // git commands
      else if (parts[0] === "git") {
        const sub = parts[1];

        if (sub === "init") {
          output.push({
            type: "success",
            text: "빈 Git 저장소가 초기화되었습니다. (.git/)",
          });
        } else if (sub === "status") {
          output.push({ type: "info", text: `현재 브랜치: ${s.currentBranch}` });
          if (s.stagingArea.length > 0) {
            output.push({ type: "staged", text: "\n커밋할 변경사항 (Staging Area):" });
            s.stagingArea.forEach((f) =>
              output.push({ type: "staged", text: `   새 파일: ${f.name}` })
            );
          }
          if (s.workingDir.length > 0) {
            output.push({ type: "modified", text: "\n추적되지 않은 파일 (Working Directory):" });
            s.workingDir.forEach((f) =>
              output.push({
                type: f.status === "modified" ? "modified" : "untracked",
                text: `   ${f.status === "modified" ? "수정됨" : "새 파일"}: ${f.name}`,
              })
            );
          }
          if (s.stagingArea.length === 0 && s.workingDir.length === 0) {
            output.push({ type: "info", text: "커밋할 변경사항 없음, 작업 폴더 깨끗함" });
          }
        } else if (sub === "add") {
          const target = parts[2];
          if (!target) {
            output.push({ type: "error", text: "사용법: git add <파일명> 또는 git add ." });
          } else if (target === ".") {
            if (s.workingDir.length === 0) {
              output.push({ type: "info", text: "추가할 파일이 없습니다." });
            } else {
              const moved = s.workingDir.splice(0);
              moved.forEach((f) => (f.status = "staged"));
              s.stagingArea.push(...moved);
              output.push({
                type: "success",
                text: `${moved.length}개 파일이 Staging Area에 추가됨`,
              });
              setAnimatingNode("stage");
              setTimeout(() => setAnimatingNode(null), 600);
            }
          } else {
            const idx = s.workingDir.findIndex((f) => f.name === target);
            if (idx < 0) {
              output.push({ type: "error", text: `'${target}' 파일을 찾을 수 없습니다.` });
            } else {
              const [file] = s.workingDir.splice(idx, 1);
              file.status = "staged";
              s.stagingArea.push(file);
              output.push({ type: "success", text: `'${target}' → Staging Area` });
              setAnimatingNode("stage");
              setTimeout(() => setAnimatingNode(null), 600);
            }
          }
        } else if (sub === "reset") {
          if (s.stagingArea.length === 0) {
            output.push({ type: "info", text: "Staging Area가 비어있습니다." });
          } else {
            const moved = s.stagingArea.splice(0);
            moved.forEach((f) => (f.status = "untracked"));
            s.workingDir.push(...moved);
            output.push({ type: "success", text: `${moved.length}개 파일이 Unstaged 됨` });
          }
        } else if (sub === "commit") {
          if (parts[2] !== "-m" || !parts[3]) {
            output.push({ type: "error", text: '사용법: git commit -m "메시지"' });
          } else if (s.stagingArea.length === 0) {
            output.push({ type: "error", text: "커밋할 변경사항이 없습니다. git add를 먼저 실행하세요." });
          } else {
            const msg = cmd.match(/-m\s+["'](.+?)["']/)?.[1] || parts.slice(3).join(" ").replace(/["']/g, "");
            const files = s.stagingArea.splice(0);
            const parentIdx = s.commits.length > 0 ?
              s.branches.find((b) => b.name === s.currentBranch)?.commitIdx ?? -1 : -1;
            const commit = {
              id: generateId(),
              hash: hashStr(msg + Date.now()),
              message: msg,
              branch: s.currentBranch,
              files: files,
              parentIdx: parentIdx,
              mergeParent: null,
              timestamp: new Date().toLocaleTimeString("ko-KR"),
            };
            s.commits.push(commit);
            const branchObj = s.branches.find((b) => b.name === s.currentBranch);
            if (branchObj) branchObj.commitIdx = s.commits.length - 1;
            output.push({
              type: "success",
              text: `[${s.currentBranch} ${commit.hash.slice(0, 7)}] ${msg}`,
            });
            output.push({
              type: "info",
              text: ` ${files.length}개 파일 변경됨`,
            });
            setAnimatingNode("commit");
            setTimeout(() => setAnimatingNode(null), 800);
          }
        } else if (sub === "log") {
          if (s.commits.length === 0) {
            output.push({ type: "info", text: "커밋 히스토리가 없습니다." });
          } else {
            const branchObj = s.branches.find((b) => b.name === s.currentBranch);
            const reachable = [];
            let idx = branchObj?.commitIdx ?? -1;
            while (idx >= 0) {
              reachable.push(s.commits[idx]);
              idx = s.commits[idx].parentIdx;
            }
            reachable.forEach((c) => {
              output.push({
                type: "hash",
                text: `commit ${c.hash}  (${c.branch})`,
              });
              output.push({ type: "info", text: `    ${c.message}` });
              output.push({ type: "dim", text: `    ${c.timestamp}` });
              output.push({ type: "dim", text: "" });
            });
          }
        } else if (sub === "branch") {
          if (!parts[2]) {
            s.branches.forEach((b) => {
              const isCurrent = b.name === s.currentBranch;
              output.push({
                type: isCurrent ? "success" : "info",
                text: `${isCurrent ? "* " : "  "}${b.name}`,
              });
            });
          } else if (parts[2] === "-d" && parts[3]) {
            const bName = parts[3];
            if (bName === s.currentBranch) {
              output.push({ type: "error", text: "현재 브랜치는 삭제할 수 없습니다." });
            } else {
              const bIdx = s.branches.findIndex((b) => b.name === bName);
              if (bIdx < 0) {
                output.push({ type: "error", text: `'${bName}' 브랜치를 찾을 수 없습니다.` });
              } else {
                s.branches.splice(bIdx, 1);
                output.push({ type: "success", text: `'${bName}' 브랜치 삭제됨` });
              }
            }
          } else {
            const bName = parts[2];
            if (s.branches.find((b) => b.name === bName)) {
              output.push({ type: "error", text: `'${bName}' 브랜치가 이미 존재합니다.` });
            } else {
              const currentBranch = s.branches.find((b) => b.name === s.currentBranch);
              s.branches.push({
                name: bName,
                commitIdx: currentBranch?.commitIdx ?? -1,
              });
              output.push({ type: "success", text: `새 브랜치 '${bName}' 생성됨` });
            }
          }
        } else if (sub === "checkout") {
          const target = parts[2];
          if (!target) {
            output.push({ type: "error", text: "사용법: git checkout <브랜치명>" });
          } else if (parts[2] === "-b" && parts[3]) {
            const bName = parts[3];
            if (s.branches.find((b) => b.name === bName)) {
              output.push({ type: "error", text: `'${bName}' 브랜치가 이미 존재합니다.` });
            } else {
              const currentBranch = s.branches.find((b) => b.name === s.currentBranch);
              s.branches.push({ name: bName, commitIdx: currentBranch?.commitIdx ?? -1 });
              s.currentBranch = bName;
              s.HEAD = bName;
              output.push({ type: "success", text: `새 브랜치 '${bName}'(으)로 전환됨` });
            }
          } else {
            const branch = s.branches.find((b) => b.name === target);
            if (!branch) {
              output.push({ type: "error", text: `'${target}' 브랜치를 찾을 수 없습니다.` });
            } else {
              if (s.workingDir.length > 0 || s.stagingArea.length > 0) {
                output.push({
                  type: "warn",
                  text: "⚠ 커밋되지 않은 변경사항이 있습니다. (시뮬레이터에서는 전환 허용)",
                });
              }
              s.currentBranch = target;
              s.HEAD = target;
              output.push({ type: "success", text: `'${target}' 브랜치로 전환됨` });
            }
          }
        } else if (sub === "merge") {
          const target = parts[2];
          if (!target) {
            output.push({ type: "error", text: "사용법: git merge <브랜치명>" });
          } else {
            const srcBranch = s.branches.find((b) => b.name === target);
            if (!srcBranch) {
              output.push({ type: "error", text: `'${target}' 브랜치를 찾을 수 없습니다.` });
            } else if (target === s.currentBranch) {
              output.push({ type: "error", text: "같은 브랜치로는 병합할 수 없습니다." });
            } else {
              const currentBranch = s.branches.find((b) => b.name === s.currentBranch);
              const mergeCommit = {
                id: generateId(),
                hash: hashStr("merge" + target + Date.now()),
                message: `Merge branch '${target}' into ${s.currentBranch}`,
                branch: s.currentBranch,
                files: [],
                parentIdx: currentBranch.commitIdx,
                mergeParent: srcBranch.commitIdx,
                timestamp: new Date().toLocaleTimeString("ko-KR"),
              };
              s.commits.push(mergeCommit);
              currentBranch.commitIdx = s.commits.length - 1;
              output.push({
                type: "success",
                text: `'${target}' → '${s.currentBranch}' 병합 완료`,
              });
              output.push({
                type: "info",
                text: `Merge commit: ${mergeCommit.hash.slice(0, 7)}`,
              });
              setAnimatingNode("merge");
              setTimeout(() => setAnimatingNode(null), 800);
            }
          }
        } else if (sub === "stash") {
          if (parts[2] === "pop") {
            if (s.stash.length === 0) {
              output.push({ type: "error", text: "stash가 비어있습니다." });
            } else {
              const stashed = s.stash.pop();
              s.workingDir.push(...stashed.workingDir);
              s.stagingArea.push(...stashed.stagingArea);
              output.push({ type: "success", text: "stash 복원 완료" });
            }
          } else if (parts[2] === "list") {
            if (s.stash.length === 0) {
              output.push({ type: "info", text: "stash가 비어있습니다." });
            } else {
              s.stash.forEach((st, i) => {
                output.push({
                  type: "info",
                  text: `stash@{${i}}: ${st.workingDir.length + st.stagingArea.length}개 파일`,
                });
              });
            }
          } else {
            if (s.workingDir.length === 0 && s.stagingArea.length === 0) {
              output.push({ type: "info", text: "저장할 변경사항이 없습니다." });
            } else {
              s.stash.push({
                workingDir: s.workingDir.splice(0),
                stagingArea: s.stagingArea.splice(0),
              });
              output.push({ type: "success", text: "변경사항이 stash에 저장됨" });
            }
          }
        } else if (sub === "diff") {
          if (s.workingDir.length === 0 && s.stagingArea.length === 0) {
            output.push({ type: "info", text: "변경사항이 없습니다." });
          } else {
            s.workingDir.forEach((f) => {
              output.push({ type: "modified", text: `--- a/${f.name}` });
              output.push({ type: "success", text: `+++ b/${f.name}` });
              output.push({ type: "info", text: `  (${f.status})` });
            });
          }
        } else {
          output.push({ type: "error", text: `알 수 없는 git 명령어: ${sub}` });
        }
      } else {
        output.push({ type: "error", text: `명령어를 찾을 수 없습니다: ${parts[0]}` });
        output.push({ type: "dim", text: "'help'를 입력하여 사용 가능한 명령어를 확인하세요." });
      }

      addLine([prompt, ...output]);
      setState(s);

      // Check tutorial progress
      const tut = TUTORIALS[tutorialIdx];
      if (tut && stepIdx < tut.steps.length) {
        const expected = tut.steps[stepIdx].cmd;
        if (cmd.trim() === expected) {
          setStepIdx((p) => p + 1);
        }
      }
    },
    [state, addLine, tutorialIdx, stepIdx]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      setCmdHistory((prev) => [...prev, input]);
      setHistoryIdx(-1);
      processCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const newIdx = historyIdx < 0 ? cmdHistory.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(newIdx);
        setInput(cmdHistory[newIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx >= 0) {
        const newIdx = historyIdx + 1;
        if (newIdx >= cmdHistory.length) {
          setHistoryIdx(-1);
          setInput("");
        } else {
          setHistoryIdx(newIdx);
          setInput(cmdHistory[newIdx]);
        }
      }
    }
  };

  const branchColors = {};
  state.branches.forEach((b, i) => {
    const cols = [COLORS.accent, COLORS.branch, COLORS.branchAlt, COLORS.branchThird, COLORS.merge];
    branchColors[b.name] = cols[i % cols.length];
  });

  const renderCommitGraph = () => {
    if (state.commits.length === 0) {
      return (
        <div style={{ color: COLORS.textDim, textAlign: "center", padding: "40px 20px", fontSize: 13 }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>◯</div>
          커밋이 없습니다<br />
          <span style={{ fontSize: 11 }}>git commit 을 실행해보세요</span>
        </div>
      );
    }

    const nodeR = 16;
    const rowH = 64;
    const colW = 40;
    const padLeft = 30;
    const padTop = 30;

    const branchLanes = {};
    let laneCount = 0;
    state.commits.forEach((c) => {
      if (!(c.branch in branchLanes)) {
        branchLanes[c.branch] = laneCount++;
      }
    });

    const svgH = state.commits.length * rowH + padTop * 2 + 30;
    const svgW = Math.max(280, laneCount * colW + padLeft * 2 + 120);

    const getPos = (idx) => {
      const c = state.commits[idx];
      const lane = branchLanes[c.branch] || 0;
      return {
        x: padLeft + lane * colW + 20,
        y: svgH - padTop - idx * rowH - 20,
      };
    };

    return (
      <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: "block" }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {state.commits.map((c, i) => {
          if (c.parentIdx < 0) return null;
          const from = getPos(i);
          const to = getPos(c.parentIdx);
          const color = branchColors[c.branch] || COLORS.accent;
          if (branchLanes[c.branch] === branchLanes[state.commits[c.parentIdx]?.branch]) {
            return <line key={`l-${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={2.5} opacity={0.6} />;
          }
          const midY = (from.y + to.y) / 2;
          return (
            <path key={`l-${i}`} d={`M${from.x},${from.y} C${from.x},${midY} ${to.x},${midY} ${to.x},${to.y}`} fill="none" stroke={color} strokeWidth={2.5} opacity={0.6} />
          );
        })}

        {state.commits.map((c, i) => {
          if (c.mergeParent == null || c.mergeParent < 0) return null;
          const from = getPos(i);
          const to = getPos(c.mergeParent);
          const midY = (from.y + to.y) / 2;
          return (
            <path key={`m-${i}`} d={`M${from.x},${from.y} C${from.x},${midY} ${to.x},${midY} ${to.x},${to.y}`} fill="none" stroke={COLORS.merge} strokeWidth={2} strokeDasharray="6,4" opacity={0.7} />
          );
        })}

        {state.commits.map((c, i) => {
          const pos = getPos(i);
          const color = branchColors[c.branch] || COLORS.accent;
          const isMerge = c.mergeParent != null;
          const isLatest = i === state.commits.length - 1;
          return (
            <g key={`n-${i}`} style={{ animation: isLatest && animatingNode === "commit" ? "nodeAppear 0.5s ease-out" : "none" }}>
              <circle cx={pos.x} cy={pos.y} r={nodeR} fill={COLORS.bg} stroke={color} strokeWidth={isMerge ? 3 : 2.5} filter={isLatest ? "url(#glow)" : undefined} />
              {isMerge && (
                <>
                  <line x1={pos.x - 6} y1={pos.y - 6} x2={pos.x + 6} y2={pos.y + 6} stroke={color} strokeWidth={2} />
                  <line x1={pos.x + 6} y1={pos.y - 6} x2={pos.x - 6} y2={pos.y + 6} stroke={color} strokeWidth={2} />
                </>
              )}
              <text x={pos.x + nodeR + 10} y={pos.y - 6} fill={COLORS.text} fontSize={11} fontFamily={FONT}>
                {c.message.length > 24 ? c.message.slice(0, 22) + "…" : c.message}
              </text>
              <text x={pos.x + nodeR + 10} y={pos.y + 10} fill={COLORS.textDim} fontSize={9} fontFamily={FONT}>
                {c.hash.slice(0, 7)}
              </text>
            </g>
          );
        })}

        {state.branches.map((b) => {
          if (b.commitIdx < 0) return null;
          const pos = getPos(b.commitIdx);
          const color = branchColors[b.name] || COLORS.accent;
          const isHead = b.name === state.currentBranch;
          return (
            <g key={`br-${b.name}`}>
              <rect x={pos.x - nodeR - 4} y={pos.y - nodeR - 22} width={b.name.length * 8 + 16} height={18} rx={4} fill={color} opacity={isHead ? 0.9 : 0.3} />
              <text x={pos.x - nodeR + 4} y={pos.y - nodeR - 9} fill={isHead ? COLORS.bg : COLORS.text} fontSize={10} fontFamily={FONT} fontWeight="bold">
                {b.name}
              </text>
              {isHead && (
                <text x={pos.x - nodeR - 4 + b.name.length * 8 + 20} y={pos.y - nodeR - 9} fill={COLORS.branchAlt} fontSize={9} fontFamily={FONT}>
                  HEAD
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  const FileChip = ({ file, area }) => {
    const statusColor = {
      untracked: COLORS.untracked,
      modified: COLORS.modified,
      staged: COLORS.staged,
      committed: COLORS.committed,
    }[file.status] || COLORS.text;

    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 6,
          background: `${statusColor}15`,
          border: `1px solid ${statusColor}40`,
          fontSize: 11,
          fontFamily: FONT,
          color: statusColor,
          animation: animatingNode === area ? "chipPop 0.4s ease-out" : "none",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }} />
        {file.name}
      </div>
    );
  };

  const renderStageView = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
      {/* Working Directory */}
      <div style={{ background: `${COLORS.modified}08`, border: `1px solid ${COLORS.modified}30`, borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.modified }} />
          <span style={{ color: COLORS.modified, fontSize: 12, fontFamily: FONT, fontWeight: 600 }}>Working Directory</span>
          <span style={{ color: COLORS.textDim, fontSize: 10, marginLeft: "auto" }}>{state.workingDir.length}개 파일</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 28 }}>
          {state.workingDir.length === 0 ? (
            <span style={{ color: COLORS.textDim, fontSize: 11 }}>비어있음</span>
          ) : (
            state.workingDir.map((f) => <FileChip key={f.name} file={f} area="work" />)
          )}
        </div>
      </div>

      {/* Arrow */}
      <div style={{ textAlign: "center", color: COLORS.textDim, fontSize: 18, lineHeight: 1 }}>
        <div style={{ fontSize: 9, fontFamily: FONT, marginBottom: 2 }}>git add</div>▼
      </div>

      {/* Staging Area */}
      <div
        style={{
          background: `${COLORS.staged}08`,
          border: `1px solid ${COLORS.staged}30`,
          borderRadius: 10,
          padding: 16,
          transition: "box-shadow 0.3s",
          boxShadow: animatingNode === "stage" ? `0 0 20px ${COLORS.staged}40` : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.staged }} />
          <span style={{ color: COLORS.staged, fontSize: 12, fontFamily: FONT, fontWeight: 600 }}>Staging Area</span>
          <span style={{ color: COLORS.textDim, fontSize: 10, marginLeft: "auto" }}>{state.stagingArea.length}개 파일</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 28 }}>
          {state.stagingArea.length === 0 ? (
            <span style={{ color: COLORS.textDim, fontSize: 11 }}>비어있음</span>
          ) : (
            state.stagingArea.map((f) => <FileChip key={f.name} file={f} area="stage" />)
          )}
        </div>
      </div>

      {/* Arrow */}
      <div style={{ textAlign: "center", color: COLORS.textDim, fontSize: 18, lineHeight: 1 }}>
        <div style={{ fontSize: 9, fontFamily: FONT, marginBottom: 2 }}>git commit</div>▼
      </div>

      {/* Repository */}
      <div
        style={{
          background: `${COLORS.committed}08`,
          border: `1px solid ${COLORS.committed}30`,
          borderRadius: 10,
          padding: 16,
          transition: "box-shadow 0.3s",
          boxShadow: animatingNode === "commit" ? `0 0 20px ${COLORS.committed}40` : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.committed }} />
          <span style={{ color: COLORS.committed, fontSize: 12, fontFamily: FONT, fontWeight: 600 }}>Repository</span>
          <span style={{ color: COLORS.textDim, fontSize: 10, marginLeft: "auto" }}>{state.commits.length}개 커밋</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 28 }}>
          {state.commits.length === 0 ? (
            <span style={{ color: COLORS.textDim, fontSize: 11 }}>커밋 없음</span>
          ) : (
            state.commits
              .slice(-5)
              .reverse()
              .map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: `${branchColors[c.branch] || COLORS.committed}15`,
                    border: `1px solid ${branchColors[c.branch] || COLORS.committed}40`,
                    fontSize: 10,
                    fontFamily: FONT,
                    color: branchColors[c.branch] || COLORS.committed,
                  }}
                >
                  <span style={{ opacity: 0.6 }}>{c.hash.slice(0, 7)}</span>
                  {c.message.length > 18 ? c.message.slice(0, 16) + "…" : c.message}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );

  const currentTutorial = TUTORIALS[tutorialIdx];

  return (
    <div
      style={{
        fontFamily: FONT,
        background: COLORS.bg,
        color: COLORS.text,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
      onClick={() => inputRef.current?.focus()}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        @keyframes nodeAppear {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes chipPop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,229,160,0.2); }
          50% { box-shadow: 0 0 0 6px rgba(0,229,160,0); }
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Header */}
      <div
        style={{
          background: COLORS.panel,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.accent, letterSpacing: 1 }}>
          GIT SIMULATOR
        </div>
        <div style={{ fontSize: 11, color: COLORS.textDim }}>
          Interactive Learning Environment
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              background: `${branchColors[state.currentBranch] || COLORS.accent}20`,
              border: `1px solid ${branchColors[state.currentBranch] || COLORS.accent}50`,
              padding: "3px 10px",
              borderRadius: 12,
              fontSize: 11,
              color: branchColors[state.currentBranch] || COLORS.accent,
            }}
          >
            ⎇ {state.currentBranch}
          </div>
          <div style={{ color: COLORS.textDim, fontSize: 11 }}>
            {state.commits.length} commits
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Terminal */}
        <div style={{ flex: "0 0 50%", display: "flex", flexDirection: "column", borderRight: `1px solid ${COLORS.border}` }}>
          <div
            ref={termRef}
            style={{
              flex: 1,
              overflow: "auto",
              padding: "12px 16px",
              background: COLORS.termBg,
              fontFamily: FONT,
              fontSize: 12,
              lineHeight: 1.7,
            }}
          >
            {termLines.map((line, i) => {
              const colorMap = {
                input: COLORS.text,
                system: COLORS.textDim,
                success: COLORS.accent,
                error: COLORS.modified,
                info: COLORS.text,
                staged: COLORS.staged,
                modified: COLORS.modified,
                untracked: COLORS.textDim,
                hash: COLORS.branchAlt,
                warn: COLORS.branchAlt,
                dim: COLORS.textDim,
              };
              return (
                <div key={i} style={{ color: colorMap[line.type] || COLORS.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {line.type === "input" ? (
                    <>
                      <span style={{ color: COLORS.accent }}>$ </span>
                      {line.text}
                    </>
                  ) : (
                    line.text
                  )}
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 16px",
              background: COLORS.panel,
              borderTop: `1px solid ${COLORS.border}`,
              gap: 8,
            }}
          >
            <span style={{ color: COLORS.accent, fontWeight: 600, fontSize: 13 }}>$</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="git 명령어를 입력하세요..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: COLORS.text,
                fontFamily: FONT,
                fontSize: 13,
                caretColor: COLORS.accent,
              }}
            />
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: "0 0 50%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.panel }}>
            {[
              { id: "visual", label: "시각화" },
              { id: "graph", label: "커밋 그래프" },
              { id: "tutorial", label: "튜토리얼" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: activeTab === tab.id ? COLORS.bg : "transparent",
                  border: "none",
                  borderBottom: activeTab === tab.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                  color: activeTab === tab.id ? COLORS.accent : COLORS.textDim,
                  fontFamily: FONT,
                  fontSize: 12,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {activeTab === "visual" && renderStageView()}

            {activeTab === "graph" && (
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 12 }}>
                  {state.branches.map((b) => (
                    <span key={b.name} style={{ marginRight: 16 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: branchColors[b.name], marginRight: 4, verticalAlign: "middle" }} />
                      {b.name}
                    </span>
                  ))}
                </div>
                {renderCommitGraph()}
              </div>
            )}

            {activeTab === "tutorial" && (
              <div style={{ padding: 16 }}>
                {/* Tutorial selector */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  {TUTORIALS.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => { setTutorialIdx(i); setStepIdx(0); }}
                      style={{
                        flex: 1,
                        padding: "8px 8px",
                        background: i === tutorialIdx ? `${COLORS.accent}20` : COLORS.panel,
                        border: `1px solid ${i === tutorialIdx ? COLORS.accent : COLORS.border}`,
                        borderRadius: 8,
                        color: i === tutorialIdx ? COLORS.accent : COLORS.textDim,
                        fontFamily: FONT,
                        fontSize: 10,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>

                {/* Progress */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textDim, marginBottom: 6 }}>
                    <span>진행률</span>
                    <span>
                      {Math.min(stepIdx, currentTutorial?.steps.length || 0)}/{currentTutorial?.steps.length || 0}
                    </span>
                  </div>
                  <div style={{ height: 4, background: COLORS.border, borderRadius: 2, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${currentTutorial ? (stepIdx / currentTutorial.steps.length) * 100 : 0}%`,
                        background: COLORS.accent,
                        borderRadius: 2,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                </div>

                {/* Steps */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {currentTutorial?.steps.map((step, i) => {
                    const done = i < stepIdx;
                    const active = i === stepIdx;
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 12,
                          padding: "12px 14px",
                          background: active ? `${COLORS.accent}10` : done ? `${COLORS.accent}05` : COLORS.panel,
                          border: `1px solid ${active ? COLORS.accent + "50" : COLORS.border}`,
                          borderRadius: 10,
                          opacity: done ? 0.5 : 1,
                          transition: "all 0.3s",
                          animation: active ? "pulse 2s infinite" : "none",
                          cursor: active ? "pointer" : "default",
                        }}
                        onClick={() => {
                          if (active) {
                            setInput(step.cmd);
                            inputRef.current?.focus();
                          }
                        }}
                      >
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: done ? COLORS.accent : active ? `${COLORS.accent}30` : COLORS.border,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            fontSize: 11,
                            fontWeight: 600,
                            color: done ? COLORS.bg : COLORS.textDim,
                          }}
                        >
                          {done ? "✓" : i + 1}
                        </div>
                        <div>
                          <div
                            style={{
                              fontFamily: FONT,
                              fontSize: 12,
                              color: active ? COLORS.accent : COLORS.text,
                              fontWeight: 500,
                              marginBottom: 2,
                            }}
                          >
                            {step.cmd}
                          </div>
                          <div style={{ fontSize: 10, color: COLORS.textDim, lineHeight: 1.4 }}>
                            {step.desc}
                          </div>
                          {active && (
                            <div style={{ fontSize: 9, color: COLORS.accent, marginTop: 4, opacity: 0.7 }}>
                              ▲ 클릭하면 터미널에 입력됩니다
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {stepIdx >= (currentTutorial?.steps.length || 0) && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: 20,
                        color: COLORS.accent,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      ✨ 튜토리얼 완료!
                      {tutorialIdx < TUTORIALS.length - 1 && (
                        <button
                          onClick={() => { setTutorialIdx((p) => p + 1); setStepIdx(0); }}
                          style={{
                            display: "block",
                            margin: "12px auto 0",
                            padding: "8px 20px",
                            background: COLORS.accent,
                            color: COLORS.bg,
                            border: "none",
                            borderRadius: 8,
                            fontFamily: FONT,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          다음 튜토리얼 →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
