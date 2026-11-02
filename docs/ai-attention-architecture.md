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

## Physical components — simple view

Each box shows **the component, where it runs, and its responsibility**.

```mermaid
flowchart TB
    LAMBDA["Lambda · AWS-managed<br/>Receives and verifies channel messages<br/>Sends accepted messages to the queue"]
    SQS["SQS FIFO · AWS-managed<br/>Queues messages in order<br/>Buffers traffic and handles delivery retries"]
    WORKER["Worker + LangGraph · Docker container on CPU EC2<br/>Understands requests, selects tools and checks permissions<br/>Manages confirmations and sends channel replies"]
    LITE["LiteLLM Proxy · Docker container on CPU EC2<br/>Routes every model request<br/>Controls model selection, limits and fallbacks"]
    MODEL["SGLang + model · Docker container on GPU EC2<br/>Runs the selected AI model<br/>Returns interpretations and proposed tool calls"]
    POSTGRES["PostgreSQL · Amazon RDS<br/>Stores users, families and financial records<br/>Persists conversation state and enforces data access"]
    FILES["S3 · AWS-managed storage<br/>Stores private audio, images and documents"]

    LAMBDA --> SQS --> WORKER
    WORKER --> LITE --> MODEL
    WORKER --> POSTGRES
    WORKER --> FILES

    classDef transport fill:#F8FAFC,stroke:#D6DFE5,color:#172B25;
    classDef agent fill:#EEF2FF,stroke:#D8E1FF,color:#172B25;
    classDef proxy fill:#EAF3F8,stroke:#D6E7F0,color:#172B25;
    classDef inference fill:#EAF4EE,stroke:#D2E8DA,color:#172B25;
    classDef storage fill:#F7F1E8,stroke:#EADFCF,color:#172B25;
    class LAMBDA,SQS transport;
    class WORKER agent;
    class LITE proxy;
    class MODEL inference;
    class POSTGRES,FILES storage;
```

**Placement:** the worker and LiteLLM can share one CPU EC2, in separate containers. SGLang runs on a separate GPU EC2. Lambda, SQS, RDS and S3 are managed AWS services, not containers on those machines. LangGraph runs inside the worker; it is not another server.

Arrows show the main dependencies. Model results return through LiteLLM, and the worker replies directly to WhatsApp or Telegram. Additional operational services remain in the [technical details](ai-attention-architecture-details.md).

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
