# AI Financial Assistant — Architecture Overview

**Selected design · Not yet implemented.** One conversational agent, organized into tool groups. This page covers AI attention only.

## Main flow

```mermaid
flowchart TB
    CHANNEL["WhatsApp / Telegram<br/>Receive messages and deliver replies"]
    ENTRY["API Gateway + Lambda<br/>Verify requests and enqueue messages"]
    QUEUE["SQS FIFO<br/>Keep messages ordered and absorb retries"]
    AGENT["AI Agent — LangGraph inside a worker<br/>Understand the request, select tools,<br/>ask questions and request confirmation"]

    CHANNEL --> ENTRY --> QUEUE --> AGENT

    AGENT --> MONEY["Transactions, Budgets & Goals<br/>Record movements and manage plans"]
    AGENT --> INVEST["Savings & Investments<br/>Manage vaults and investment movements"]
    AGENT --> KNOW["Queries & Documents<br/>Read reports and find family information"]
    AGENT --> REMIND["Reminders<br/>Manage scheduled follow-ups"]

    MONEY --> BUSINESS
    INVEST --> BUSINESS
    KNOW --> BUSINESS
    REMIND --> BUSINESS

    BUSINESS["Trusted tool code + PostgreSQL<br/>Identity, permissions, validation,<br/>calculations and safe execution"]

    classDef channel fill:#F8FAFC,stroke:#CBD5E1,color:#172B25;
    classDef transport fill:#F3F4F6,stroke:#D1D5DB,color:#172B25;
    classDef agent fill:#EEF2FF,stroke:#C7D2FE,color:#172B25;
    classDef money fill:#EAF3F8,stroke:#D6E7F0,color:#172B25;
    classDef investment fill:#EAF4EE,stroke:#D2E8DA,color:#172B25;
    classDef knowledge fill:#F7F1E8,stroke:#EADFCF,color:#172B25;
    classDef reminders fill:#F3EDFA,stroke:#E1D4EF,color:#172B25;
    classDef business fill:#F8FAFC,stroke:#CBD5E1,color:#172B25;
    class CHANNEL channel;
    class ENTRY,QUEUE transport;
    class AGENT agent;
    class MONEY money;
    class INVEST investment;
    class KNOW knowledge;
    class REMIND reminders;
    class BUSINESS business;
```

**The four branches are tool groups, not four agents.** The agent only receives the tools relevant to the request and the user's permissions. The worker sends the final response directly to WhatsApp or Telegram; the diagram follows the request direction for readability.

## Physical deployment — what runs where

**Proposed initial AWS placement, not deployed infrastructure.** Boxes represent hosting boundaries: AWS region → VPC/private network → EC2 machine → Docker containers. Managed AWS services do not run inside our Docker hosts.

```mermaid
flowchart TB
    CHANNELS["WhatsApp / Telegram APIs"]
    PROVIDERS["Approved external model providers<br/>Fallback only through LiteLLM"]

    subgraph AWS["AWS account / region"]
        direction TB
        subgraph MANAGED["AWS-managed services — no EC2 or Docker to maintain"]
            direction LR
            INGRESS["API Gateway + Lambda<br/>Public HTTPS ingress and verification"]
            FIFO["SQS FIFO + dead-letter queue<br/>Ordered events and retry isolation"]
            SCHEDULER["EventBridge Scheduler<br/>Scheduled reminder events"]
            S3STORE["Private S3 buckets<br/>Media, documents and trace objects"]
            SECRETSTORE["Secrets Manager<br/>Credentials and API secrets"]
            MONITOR["CloudWatch<br/>Infrastructure logs and alarms"]
        end

        subgraph VPC["VPC — private subnets / security groups"]
            direction TB
            subgraph APPSERVER["EC2 A — Application server / CPU"]
                subgraph APPDOCKER["Docker Compose"]
                    WORKER["Worker container<br/>Python + LangGraph + tools<br/>Inbox, media and direct channel replies"]
                    LITELLM["LiteLLM container<br/>Model gateway, routing and limits"]
                end
            end

            subgraph GPUSERVER["EC2 B — Inference server / GPU"]
                subgraph GPUDOCKER["Docker + NVIDIA runtime"]
                    SGLANG["SGLang container<br/>Selected open-source model"]
                end
                MODELSTORE["EBS volume<br/>Model weights and cache"]
            end

            subgraph OBSSERVER["EC2 C — Observability server / CPU"]
                subgraph OBSDOCKER["Docker Compose — Langfuse stack"]
                    LANGFUSE["Langfuse web + worker containers<br/>Traces, costs and evaluations"]
                    SUPPORT["ClickHouse + Redis containers<br/>Langfuse analytics and background work"]
                end
                OBSSTORE["Persistent EBS volume<br/>ClickHouse data and backups policy"]
            end

            RDSSTORE[("Amazon RDS for PostgreSQL<br/>Business data, inbox and checkpoints<br/>Separate databases for observability/gateway")]
        end
    end

    CHANNELS --> INGRESS
    INGRESS --> FIFO
    SCHEDULER --> FIFO
    FIFO -->|Worker polls| WORKER
    FIFO -.->|DLQ alarm| MONITOR
    WORKER -->|Direct response| CHANNELS
    WORKER --> LITELLM
    LITELLM --> SGLANG
    LITELLM -->|Approved fallback| PROVIDERS
    SGLANG --- MODELSTORE
    WORKER --> RDSSTORE
    WORKER --> S3STORE
    WORKER -.-> LANGFUSE
    LITELLM -.-> LANGFUSE
    LANGFUSE --> SUPPORT
    LANGFUSE --> RDSSTORE
    LANGFUSE --> S3STORE
    SUPPORT --- OBSSTORE
    LITELLM -->|Gateway configuration / usage| RDSSTORE
    SECRETSTORE -.-> INGRESS
    SECRETSTORE -.-> WORKER
    SECRETSTORE -.-> LITELLM

    classDef managed fill:#F7F1E8,stroke:#EADFCF,color:#172B25;
    classDef application fill:#EEF2FF,stroke:#C7D2FE,color:#172B25;
    classDef inference fill:#EAF4EE,stroke:#D2E8DA,color:#172B25;
    classDef observability fill:#F3EDFA,stroke:#E1D4EF,color:#172B25;
    classDef storage fill:#EAF3F8,stroke:#D6E7F0,color:#172B25;
    class INGRESS,FIFO,SCHEDULER,SECRETSTORE,MONITOR managed;
    class WORKER,LITELLM application;
    class SGLANG inference;
    class LANGFUSE,SUPPORT observability;
    class RDSSTORE,S3STORE,MODELSTORE,OBSSTORE storage;
```

| Physical boundary | What runs there |
|---|---|
| **EC2 A · CPU · Docker Compose** | Two containers: our worker and LiteLLM. LangGraph and tool code live **inside the worker**, not in more servers. |
| **EC2 B · GPU · Docker + NVIDIA runtime** | SGLang inference container, with model weights/cache on EBS. Select a compatible GPU, such as g5, after measuring model memory requirements. |
| **EC2 C · CPU · Docker Compose** | Self-hosted Langfuse: web, background worker, ClickHouse and Redis containers. This Redis serves Langfuse; an application Redis remains optional. |
| **RDS · managed PostgreSQL** | Application data and a separate checkpoint schema. Langfuse and LiteLLM use separate databases/users; never reuse the agent's financial database permissions. |
| **S3, SQS, Lambda, API Gateway, Scheduler, Secrets Manager, CloudWatch** | AWS-managed resources. They are not containers on any of those EC2 machines. |

Only the channel ingress is public. EC2 services and RDS remain private; outbound channel/provider requests use controlled egress, AWS service access uses appropriate endpoints/egress, and the Langfuse UI is reached through private administrative access. Infrastructure logs go to CloudWatch; model/conversation traces go to Langfuse. Dashed arrows show supporting paths rather than additional conversation steps. Service IAM roles determine which secrets each component can read; the diagram abbreviates those relationships.

**Starting footprint: three EC2 machines plus managed AWS services.** The GPU can be deferred while using approved hosted models through LiteLLM. This initial single-host-per-role layout is not highly available: application replicas and independent gateway scaling come later; RDS availability and backup settings are configured separately. Local stateful containers require persistent volumes and tested backups. Docker Compose does not provide cross-host failover by itself.

This is the target placement for the selected design. Moving existing Supabase data/authentication to RDS remains a separate migration decision; this diagram does not make that migration happen.

## Responsibilities around the agent

| Component | Responsibility |
|---|---|
| **Worker + LangGraph** | Combine short message bursts, resolve context, process media, conduct the conversation and resume pending confirmations. |
| **LiteLLM** | The single gateway for every model call: choose model aliases, apply limits and control fallbacks. The agent does not call providers directly. |
| **SGLang / model providers** | Run the models. SGLang serves the selected open-source model on an EC2 GPU; approved external providers are fallback options. |
| **PostgreSQL / RDS** | Store identity, family permissions, business records and durable conversation state. Checkpoints are separate from financial data. |
| **S3** | Store private audio, receipt images and documents. Image-extracted financial data always requires confirmation before posting. |
| **EventBridge Scheduler** | Send reminder events back into the queue. The worker checks channel delivery rules before sending. |
| **Langfuse** | Measure latency and cost, trace failures and evaluate conversation quality. |
| **Secrets Manager** | Keep credentials outside prompts, queue messages and source code. |

**LangGraph is a library inside the worker, not another server. LangChain is optional. n8n and FastAPI are not required in this conversation path.**

## Examples from our assistant

| User request | What happens |
|---|---|
| “I spent 50 BOB on groceries.” | The agent selects transaction tools. Code resolves the family and validates the data; the database records the expense once. |
| “Did we reach our savings goal?” | Query tools return this month's actual savings and target. The agent explains the result; investment transfers are shown separately. |
| “Move 700 BOB into my USD travel vault.” | Code prepares the amounts and exchange rate. The agent requests confirmation, then executes the approved internal movement. |
| Sends a receipt image | The worker stores it in S3 and requests structured extraction through LiteLLM. The user confirms the extracted data before it is recorded. |

The model interprets and explains. **Code and the database control permissions, amounts and financial writes.**

[Detailed implementation notes, recovery flows and delivery roadmap](ai-attention-architecture-details.md).

Deployment references: [Langfuse Docker Compose](https://langfuse.com/self-hosting/deployment/docker-compose), [SGLang Docker installation](https://docs.sglang.ai/get_started/install.html).
