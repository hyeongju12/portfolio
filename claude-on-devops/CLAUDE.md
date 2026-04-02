# Project Context

## Infrastructure
- Cloud: AWS (ap-northeast-2)
- IaC: Terraform
- K8s: EKS 1.29+
- GitOps: ArgoCD
- CI/CD: GitLab CI

## Subagent Rules
- Terraform 변경 리뷰 → tf-reviewer 에이전트 사용
- ArgoCD/Helm 매니페스트 검증 → argocd-validator 사용
- EKS 이슈 분석 → eks-debugger 사용

## Conventions
- Terraform: 모듈 기반 구조, snake_case
- K8s manifests: kustomize overlay 패턴
- 태깅 필수: Project, Environment, Team, ManagedBy