# terraform/main.tf
resource "aws_security_group" "bad_example" {
  name        = "test-sg"
  description = "Test SG with issues"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]  # CRITICAL: 전체 개방
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # tags 없음 - WARNING
}

resource "aws_iam_policy" "overly_permissive" {
  name = "test-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "*"           # CRITICAL: wildcard
      Resource = "*"           # CRITICAL: wildcard
    }]
  })
}