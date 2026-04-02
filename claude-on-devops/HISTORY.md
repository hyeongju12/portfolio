# hjyoo-eks 작업 이력

## 2026-04-02

### 1. 노드별 CPU/메모리 확인

**클러스터:** hjyoo-eks (ap-northeast-2) | **노드:** 2x t3.xlarge

| 노드 | CPU 사용 | Memory 사용 | 상태 |
|---|---|---|---|
| ip-10-100-3-9 (2a) | 32m / 3920m (0%) | 504Mi / 14.4GiB (3%) | Ready |
| ip-10-100-5-246 (2b) | 24m / 3920m (0%) | 387Mi / 14.4GiB (2%) | Ready |

- Pressure 없음, 두 노드 모두 정상
- kube-system 컴포넌트만 운영 중 (coredns x2, metrics-server x2, aws-node, kube-proxy)

---

### 2. VPC CNI IP 할당 현황 및 aws-node 설정 확인

**VPC CNI 버전:** v1.20.4

| 설정 | 값 |
|---|---|
| WARM_ENI_TARGET | 1 |
| warm-ip-target | 1 |
| minimum-ip-target | 3 |
| ENABLE_PREFIX_DELEGATION | false (당시) |
| AWS_VPC_K8S_CNI_CUSTOM_NETWORK_CFG | false (당시) |

**발견된 문제:**
- `WARM_PREFIX_TARGET` 설정 불일치: DaemonSet env `1` vs ConfigMap `0`

---

### 3. Prefix Delegation 활성화

**변경 내용:**

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| ENABLE_PREFIX_DELEGATION | false | **true** |
| warm-prefix-target (ConfigMap) | 0 | **1** (불일치 정리) |
| 노드당 최대 Pod IP | ~45개 | **~450개** |

**작업 순서:**
1. `amazon-vpc-cni` ConfigMap 패치 (`enable-prefix-delegation: true`, `warm-prefix-target: 1`)
2. aws-node DaemonSet 환경변수 설정 (`ENABLE_PREFIX_DELEGATION=true`)
3. aws-node rollout 완료 대기
4. 두 노드 순차 rolling restart (cordon → drain → uncordon)

---

### 4. Custom Networking 적용

**구성:**

| AZ | ENIConfig | 서브넷 | CIDR | Security Group |
|---|---|---|---|---|
| ap-northeast-2a | ap-northeast-2a | subnet-0a3f1771abc91e028 | 10.100.3.0/24 | sg-0e98876ee3afaf463 |
| ap-northeast-2b | ap-northeast-2b | subnet-03b85b70edeeb18b7 | 10.100.5.0/24 | sg-0e98876ee3afaf463 |

> 기존 노드 서브넷 재활용. Pod 전용 서브넷 분리 필요 시 Terraform으로 신규 서브넷 추가 후 ENIConfig subnet 값만 교체하면 됨.

**aws-node DaemonSet 추가 설정:**
- `AWS_VPC_K8S_CNI_CUSTOM_NETWORK_CFG=true`
- `ENI_CONFIG_LABEL_DEF=topology.kubernetes.io/zone` (AZ 레이블 기반 자동 ENIConfig 선택)

**작업 순서:**
1. ENIConfig CRD 생성 (ap-northeast-2a, ap-northeast-2b)
2. aws-node DaemonSet 환경변수 설정 및 rollout
3. 기존 노드 terminate (i-0953aaeb10dc984e6, i-0bf1750dd0ecff55c)
4. ASG가 새 노드 자동 시작 → Ready 확인

**교체 전후 노드:**

| | 교체 전 | 교체 후 |
|---|---|---|
| 2a 노드 | ip-10-100-3-9 | ip-10-100-3-145 |
| 2b 노드 | ip-10-100-5-246 | ip-10-100-5-215 |

---

### 5. Custom Networking 동작 검증

**테스트 결과:**

| 항목 | 결과 |
|---|---|
| Pod IP가 ENIConfig 서브넷 내 할당 | PASS |
| Cross-AZ Pod 간 통신 (0% packet loss) | PASS |
| DNS 해석 (kubernetes.default.svc.cluster.local) | PASS |
| 외부 통신 (HTTPS) | PASS |
| Secondary ENI에 /28 Prefix 할당 (Prefix Delegation 동시 동작) | PASS |

**최종 ENI 구조 (2a 노드 기준):**
```
Primary ENI  (eni-0c267d374984a8cea) → 노드 IP 전용  (Custom Networking 효과)
Secondary ENI (eni-06c3c87b5da716731) → Pod IP 전용
  └─ Prefix: 10.100.3.112/28         (Prefix Delegation 효과)
  └─ Prefix: 10.100.3.64/28
```
