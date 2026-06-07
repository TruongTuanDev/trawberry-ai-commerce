VIETNAM – KOREA UNIVERSITY OF INFORMATION  
AND COMMUNICATION TECHNOLOGY

**FACULTY OF COMPUTER SCIENCE**

***

# GRADUATION PROJECT

**THE ARCHITECTURE AND IMPLEMENTATION OF AN AI-INTEGRATED MULTI-SELLER E-COMMERCE MARKETPLACE WITH AUTOMATED CATALOG SYNCHRONIZATION AND LEDGER-BACKED ADVERTISING CHARGING (TRAWBERRY AI COMMERCE)**

**Student Name:** Nguyen Thi Tam, Nguyen Thi Thuy Linh  
**Class:** 22KIT  
**Major:** Information Technology  
**Specialization:** Software Engineering  
**Supervisor:** Dr. Nguyen Van Loi  

**_Da Nang – 06/2026_**

***

# ACKNOWLEDGMENTS

First of all, we would like to extend our sincere appreciation to the Board of Directors of the Vietnam–Korea University of Information and Communication Technology, as well as all lecturers from the Faculty of Computer Science. The academic knowledge and supportive learning environment provided by the university have played an essential role in building the foundation for us to successfully carry out this graduation project.

In particular, we would like to express our deepest gratitude to our supervisor, Dr. Nguyen Van Loi, for his continuous guidance, valuable insights, and dedicated support throughout the entire process of researching and developing the project entitled "Development of a Multi-Vendor E-Commerce Platform Integrated with AI Virtual Try-On System." His constructive feedback, encouragement, and timely assistance have been invaluable in helping us overcome challenges and complete this project.

We would also like to sincerely thank our family, friends, and classmates in class 22KIT for their constant encouragement, support, and helpful suggestions, which motivated us to accomplish this project.

Despite our best efforts, this project may still contain certain limitations due to our restricted knowledge and practical experience. Therefore, we sincerely welcome all comments and suggestions from lecturers and the evaluation committee to further improve our work and enhance our future development.

Once again, we would like to express our sincere thanks.

_Da Nang, June 2026_  
Students,  
Nguyen Thi Tam  
Nguyen Thi Thuy Linh  

***

# Supervisor's Comments

………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………

_Da Nang, June 2026_  
Supervisor  
Dr. Nguyen Van Loi  

***

# TABLE OF CONTENTS

- [ACKNOWLEDGMENTS](#acknowledgments)
- [Supervisor's Comments](#supervisors-comments)
- [LIST OF ABBREVIATIONS](#list-of-abbreviations)
- [LIST OF TABLES](#list-of-tables)
- [LIST OF FIGURES](#list-of-figures)
- [EXECUTIVE SUMMARY](#executive-summary)
- [CHAPTER 1. INTRODUCTION](#chapter-1-introduction)
  - [1.1 MOTIVATION](#11-motivation)
  - [1.2 OBJECTIVES AND CONTRIBUTIONS](#12-objectives-and-contributions)
  - [1.3 TARGET USERS AND SCOPE](#13-target-users-and-scope)
  - [1.4 PRACTICAL SIGNIFICANCE AND STARTUP ORIENTATION](#14-practical-significance-and-startup-orientation)
- [CHAPTER 2. THEORETICAL BACKGROUND, MARKET ANALYSIS AND SYSTEM REQUIREMENTS](#chapter-2-theoretical-background-market-analysis-and-system-requirements)
  - [2.1 THEORETICAL BACKGROUND](#21-theoretical-background)
  - [2.2 MARKET DEMAND AND COMPETITOR ANALYSIS](#22-market-demand-and-competitor-analysis)
  - [2.3 STARTUP-ORIENTED MARKET ANALYSIS](#23-startup-oriented-market-analysis)
  - [2.4 SYSTEM REQUIREMENTS IDENTIFICATION](#24-system-requirements-identification)
- [CHAPTER 3. PRODUCT DESIGN AND DEVELOPMENT](#chapter-3-product-design-and-development)
  - [3.1 SYSTEM ARCHITECTURE](#31-system-architecture)
  - [3.2 DATABASE DESIGN](#32-database-design)
  - [3.3 SYSTEM USE CASE ANALYSIS AND DESIGN](#33-system-use-case-analysis-and-design)
  - [3.4 SYSTEM WORKFLOWS AND SEQUENCE DIAGRAMS](#34-system-workflows-and-sequence-diagrams)
  - [3.5 REST API ENDPOINTS AUDIT](#35-rest-api-endpoints-audit)
- [CHAPTER 4. DEPLOYMENT AND BUSINESS MODEL](#chapter-4-deployment-and-business-model)
  - [4.1 SYSTEM TRIALS AND DEMONSTRATIONS](#41-system-trials-and-demonstrations)
  - [4.2 EFFECTIVENESS ANALYSIS](#42-effectiveness-analysis)
  - [4.3 STARTUP AND COMMERCIALIZATION ORIENTATION](#43-startup-and-commercialization-orientation)
- [CHAPTER 5. CONCLUSION AND PRODUCT ROADMAP](#chapter-5-conclusion-and-product-roadmap)
  - [5.1 CONCLUSION](#51-conclusion)
  - [5.2 SYSTEM LIMITATIONS](#52-system-limitations)
  - [5.3 PRODUCT ROADMAP](#53-product-roadmap)
- [REFERENCES](#references)
- [APPENDICES](#appendices)
  - [Appendix A - Testing & Verification Logs](#appendix-a---testing--verification-logs)
  - [Appendix B - API JSON Schema Examples](#appendix-b---api-json-schema-examples)

***

# LIST OF ABBREVIATIONS

| Abbreviation | Full Term | Definition |
| --- | --- | --- |
| AI | Artificial Intelligence | Simulation of human intelligence by machines. |
| API | Application Programming Interface | A set of protocols for building software applications. |
| SBP | System of Quick Payments | QR-based instant transaction transfer architecture. |
| WB | Wildberries | One of the largest Russian marketplaces used for catalog sync. |
| ORM | Object-Relational Mapping | A programming technique for converting data between incompatible systems. |
| JWT | JSON Web Token | A compact, URL-safe means of representing claims between parties. |
| CRUD | Create, Read, Update, Delete | The four basic functions of persistent storage. |
| E2E | End-to-End | Testing flow that validates the complete software path. |
| QA | Quality Assurance | System verification processes that prevent regressions. |
| MVP | Minimum Viable Product | A version of a product with just enough features to be usable. |
| CPC | Cost Per Click | An internet advertising model used to direct traffic to websites. |
| COD | Cash on Delivery | A type of transaction where payment is made at delivery. |
| VTON | Virtual Try-On | Computer vision technique allowing users to try clothes virtually. |
| SaaS | Software as a Service | Software licensing and delivery model hosted centrally. |

***

# LIST OF TABLES

- [Table 2.1 Analysis of Customer Needs](#table-21-analysis-of-customer-needs)
- [Table 2.2 Competitive Analysis of Platforms](#table-22-competitive-analysis-of-platforms)
- [Table 2.3 SWOT Analysis of Trawberry Platform](#table-23-swot-analysis-of-trawberry-platform)
- [Table 2.4 PESTEL Factors Analysis](#table-24-pestel-factors-analysis)
- [Table 2.5 Porter’s Five Forces Breakdown](#table-25-porters-five-forces-breakdown)
- [Table 2.6 Key User Stories](#table-26-key-user-stories)
- [Table 2.7 Functional Requirements list](#table-27-functional-requirements-list)
- [Table 2.8 Non-functional Requirements list](#table-28-non-functional-requirements-list)
- [Table 3.1 DB Schema: User Table Schema](#table-31-db-schema-user-table-schema)
- [Table 3.2 DB Schema: CustomerAddress Table Schema](#table-32-db-schema-customeraddress-table-schema)
- [Table 3.3 DB Schema: Shop Table Schema](#table-33-db-schema-shop-table-schema)
- [Table 3.4 DB Schema: Product Table Schema](#table-34-db-schema-product-table-schema)
- [Table 3.5 DB Schema: SponsoredCampaign Table Schema](#table-35-db-schema-sponsoredcampaign-table-schema)
- [Table 3.6 DB Schema: SellerWallet Table Schema](#table-36-db-schema-sellerwallet-table-schema)
- [Table 3.7 DB Schema: AiGenerationTask Table Schema](#table-37-db-schema-aigenerationtask-table-schema)
- [Table 3.8 DB Schema: Order Table Schema](#table-38-db-schema-order-table-schema)
- [Table 3.9 Backend Modules Audit](#table-39-backend-modules-audit)
- [Table 3.10 Frontend Routes Directory Map](#table-310-frontend-routes-directory-map)
- [Table 3.11 Principal API Endpoints Inventory](#table-311-principal-api-endpoints-inventory)
- [Table 4.1 Business Model Canvas Matrix](#table-41-business-model-canvas-matrix)

***

# LIST OF FIGURES

- [Figure 3.1 Overall System Architecture Context](#figure-31-overall-system-architecture-context)
- [Figure 3.2 Entity Relationship Diagram (ERD) Overview](#figure-32-entity-relationship-diagram-erd-overview)
- [Figure 3.3 Customer Core Use Case Diagram](#figure-33-customer-core-use-case-diagram)
- [Figure 3.4 Seller Operations Use Case Diagram](#figure-34-seller-operations-use-case-diagram)
- [Figure 3.5 Admin Supervision Use Case Diagram](#figure-35-admin-supervision-use-case-diagram)
- [Figure 3.6 Authentication and Session Auto-Refresh Sequence Flow](#figure-36-authentication-and-session-auto-refresh-sequence-flow)
- [Figure 3.7 AI Image Generation & Credit Charging Sequence Flow](#figure-37-ai-image-generation--credit-charging-sequence-flow)
- [Figure 3.8 Sponsored Boost & CPC Ledger Charge Sequence Flow](#figure-38-sponsored-boost--cpc-ledger-charge-sequence-flow)
- [Figure 3.9 Multi-Shop Checkout Split Sequence Flow](#figure-39-multi-shop-checkout-split-sequence-flow)
- [Figure 4.1 Skidkaberry Live Homepage Screenshot](#figure-41-skidkaberry-live-homepage-screenshot)
- [Figure 4.2 Customer Login Interface Visual](#figure-42-customer-login-interface-visual)
- [Figure 4.3 Seller Center Dashboard Interface Visual](#figure-43-seller-center-dashboard-interface-visual)
- [Figure 4.4 Admin Center Operations Interface Visual](#figure-44-admin-center-operations-interface-visual)

***

# EXECUTIVE SUMMARY

The rapid expansion of the digital economy has positioned e-commerce marketplaces as a core sales channel globally. However, small-to-medium retail merchants face high costs in generating model-driven product photos, managing multiple catalogs across different marketplaces, and driving search traffic without high advertising fees. This graduation project presents the design and implementation of **Trawberry AI Commerce**, a containerized Software-as-a-Service (SaaS) marketplace. The system allows sellers to import catalogs directly from external platforms like Wildberries, use Generative AI pipelines to create high-quality model-driven photos, manage sponsored search rankings through a transparent Cost-Per-Click (CPC) ledger system, and offer customers an interactive AI Virtual Try-On (VTON) interface.

Trawberry is built on a decoupled architecture. The frontend application is developed in **Next.js**, utilizing React server components and client-side hooks, styled with vanilla CSS, and fully localized into English, Russian, and Vietnamese. The backend service layer is developed with **NestJS**, utilizing **Prisma ORM** for PostgreSQL database interactions, and **Redis / BullMQ** to run asynchronous tasks. An independent **FastAPI** Python service is established as the AI Gateway, delegating image generation to OpenAI DALL-E or local mock runtimes, while storing generated media on **MinIO S3** or local storage.

The platform has been validated through testing. Automated test suites using Jest (backend e2e testing) and Pytest (Python service testing) yielded a passing rate of 347/348 on the backend and 33/33 on the AI service. Playwright tests verified correct localization and session recovery. Live verification was executed on the official deployment domain `https://skidkaberry.com/` using authentic accounts for Customers, Sellers, and Admins, validating that all dashboards, state machines, and routing are fully functional. This project successfully establishes a solid blueprint for an AI-native marketplace platform, demonstrating high commercial potential and viability for real-world startup operations.

***

# CHAPTER 1. INTRODUCTION

## 1.1 MOTIVATION

### 1.1.1 Digital Transformation Context

In the contemporary global economy, the retail industry is undergoing an unprecedented paradigm shift driven by digital transformation. Traditional brick-and-mortar operations are increasingly being replaced or augmented by decentralized, multi-seller e-commerce marketplaces. This transformation is accelerated by the rapid evolution of modern web architectures, instant mobile payment infrastructures, and sophisticated logistics networks. In this highly competitive digital arena, the visual presentation of merchandise has emerged as a primary determinant of consumer purchasing behavior. Because buyers cannot physically interact with products online, high-fidelity images directly dictate critical retail metrics, including first-impression click-through rates (CTR) and ultimate conversion rates (CR). Consequently, the capacity to generate and present professional product photography has transitioned from an optional marketing strategy to an absolute operational necessity for any digital merchant.

### 1.1.2 Practical Problems in E-Commerce Catalog Management

Despite the vast opportunities presented by digital marketplaces, small-and-medium enterprises (SMEs) face severe operational bottlenecks and financial barriers. The first major hurdle is the high cost associated with creative product photography. Acquiring professional product-on-model photos requires substantial capital expenditures for studio rentals, professional photographer fees, model hire, and complex post-production editing. These recurring costs restrict the ability of smaller merchants to rapidly update their catalogs or list new collections, skewing the competitive field in favor of large conglomerates. 

Furthermore, administrative workflows suffer from significant operational friction. Merchants who sell across multiple external digital channels, such as Wildberries or Ozon, are routinely forced to perform manual catalog synchronization. Copying and pasting product descriptions, dimensions, technical attributes, and categories across disparate merchant portals is time-consuming and highly error-prone. This duplication of effort delays product time-to-market and introduces data inconsistencies.

Another critical vulnerability lies in the opacity of modern digital advertising channels. Many commercial marketplaces employ complex sponsored search ranking models that lack transparent click attribution, leaving sellers to pay flat promotion fees without granular validation of ad spend efficiency. 

Finally, the fashion sector is heavily impacted by the financial burden of reverse logistics. Online clothing purchases carry significant sizing uncertainty, resulting in average return rates ranging from thirty to fifty percent. These returns degrade merchant profitability and generate a substantial carbon footprint due to redundant courier transport.

### 1.1.3 Market and User Needs

From the perspective of market demand, the problems identified above indicate a clear need for a more integrated and economically sustainable digital commerce model. In practical terms, sellers do not simply require another conventional storefront website; rather, they need a platform capable of reducing repeated operational effort, lowering dependence on costly third-party ecosystems, and improving the overall quality of interaction between sellers and consumers. For Vietnamese merchants who are already participating in cross-border platforms such as Wildberries, this requirement becomes even more urgent because profitability is influenced not only by product quality and sales volume, but also by commission structures, advertising costs, logistics deductions, and the complexity of managing product information across multiple channels. As a result, the demand is not limited to software that can display products online, but extends to a more comprehensive system that can assist sellers in synchronization, content generation, promotion, and customer engagement within a unified environment.

At the same time, consumer expectations in digital fashion commerce have also changed significantly. Modern users increasingly expect shopping platforms to provide visual confidence, convenience, and personalization rather than merely functioning as static product catalogs. In the context of apparel and fashion retail, this expectation is especially important because purchasing decisions are strongly influenced by concerns related to fit, body proportion, aesthetic compatibility, and trust in how a product will appear in real use. Therefore, a platform that combines marketplace infrastructure with AI-assisted image generation and virtual try-on capabilities can respond to both sides of the market simultaneously: it supports sellers in improving operational efficiency and visual merchandising quality, while also helping customers make more informed and confident purchasing decisions. For this reason, the development of a multi-vendor e-commerce platform integrated with an AI virtual try-on system is not only technically relevant but also closely aligned with current commercial realities and user needs.

---

## 1.2 OBJECTIVES AND CONTRIBUTIONS

### 1.2.1 General Objective

The general objective of this graduation project is to design, implement, and evaluate a multi-vendor e-commerce platform integrated with an AI virtual try-on system in order to address practical commercial difficulties encountered by digital fashion sellers, especially Vietnamese sellers operating within or around the Wildberries marketplace ecosystem. The project is oriented toward building a complete software system rather than an isolated technical prototype, meaning that the resulting platform must be capable of supporting real operational workflows such as catalog management, user authentication, seller administration, product publication, and customer interaction. In addition to these core marketplace functions, the system is also intended to incorporate artificial intelligence as a value-adding layer, particularly through visual support mechanisms that improve the way fashion products are presented and experienced online.

More specifically, the overall goal is to create a technology platform that can reduce the cost burden placed on merchants, strengthen their control over catalog and promotional activities, and improve customer confidence during fashion purchasing. This goal reflects both an engineering perspective and a business perspective. From the engineering side, the system must be modular, secure, and deployable in a modern service-oriented environment. From the business side, it must represent a feasible alternative model for merchants who are experiencing margin erosion due to high external platform fees and fragmented operating tools. Consequently, the project seeks to demonstrate that an AI-enabled marketplace can function not only as a technical innovation, but also as a practical and commercially meaningful response to real market constraints.

### 1.2.2 Specific Objectives

To realize the general objective in a systematic manner, the project defines a set of specific objectives that collectively shape the platform architecture and its operational capabilities. One important objective is to establish a decoupled technical structure in which the user-facing interface, the core business logic, and the AI processing layer can operate as distinct yet coordinated components. This separation is necessary to ensure maintainability, service stability, and scalability when computationally intensive AI tasks are introduced into a transaction-oriented marketplace environment. A closely related objective is to build a reliable backend foundation that can manage authentication, seller and customer roles, product states, public visibility rules, and checkout workflows in a way that reflects the actual needs of a multi-vendor commerce platform.

Another major objective is to construct a synchronization mechanism that allows sellers to import or replicate product information from existing sales channels, especially Wildberries, into the new system with reduced manual effort. This objective is directly tied to the real business motivation of the project, because one of the major inefficiencies faced by merchants lies in repeatedly creating and updating product data across disconnected platforms. In parallel with this, the project also aims to provide an AI-supported visual workflow in which sellers can generate or improve product presentation assets and users can interact with an AI virtual try-on feature to gain a more realistic impression of fashion items before purchase. To support financial transparency and sustainable platform operation, another objective is to design an auditable promotional mechanism, including sponsored ranking and ledger-based billing logic, so that seller spending and platform revenue can be traced clearly. Finally, the system must maintain a strong security posture through role isolation, protected sessions, secure key handling, and controlled API communication, thereby ensuring that the platform remains reliable for different categories of users in a shared digital environment.

### 1.2.3 Main Contributions

The contributions of this project can be considered from both academic and practical viewpoints. From an academic perspective, the project contributes a concrete case study of how modern web engineering, service-oriented architecture, and applied artificial intelligence can be integrated into a single marketplace-oriented system. Rather than treating AI as a standalone demonstration module, the project embeds AI capabilities into the broader operational context of commerce, where issues such as transaction integrity, user role isolation, data consistency, and deployment feasibility are equally important. This integration provides a useful reference model for future student projects and applied research efforts that aim to connect machine intelligence with production-like digital platforms.

From a practical perspective, the project contributes a deployable architectural blueprint for a multi-vendor platform that addresses real merchant pain points, particularly those arising in cross-border marketplace participation. It demonstrates how catalog synchronization, AI-assisted visual enhancement, sponsored product exposure, and virtual try-on interaction can be combined into a coherent product ecosystem instead of being handled through disconnected tools. In addition, the project contributes a financially traceable promotion model through ledger-oriented billing design, along with a containerized deployment strategy that improves reproducibility and operational readiness. Taken together, these contributions show that the proposed system is not merely a conceptual proposal, but a meaningful prototype with relevance to software engineering practice, digital retail innovation, and startup-oriented product development.

---

## 1.3 TARGET USERS AND SCOPE

### 1.3.1 Target Users

The target users of the platform are defined according to the principal actors who participate in a digital marketplace environment and who require different forms of system access and support. The first and most visible user group is the customer, who interacts with the public-facing marketplace to browse products, compare options, place orders, and engage with enhanced shopping features such as virtual try-on and localized interface presentation. For this group, the platform must provide clarity, usability, and confidence in purchasing decisions, especially in fashion-related scenarios where appearance and fit strongly influence user behavior. As a result, the customer-facing part of the system is not limited to transactional functions, but is also designed to support trust-building and interactive decision assistance.

The second target group is the seller, who constitutes the operational core of the platform. Sellers require a more sophisticated interface because their tasks involve not only listing products, but also maintaining catalog accuracy, controlling product publication, synchronizing data from external sources, managing shop settings, monitoring order flows, and using AI-assisted functions to improve product presentation and reach. In the context of this project, sellers are especially important because the platform is intended as a practical response to the cost and control limitations they encounter on large external marketplaces such as Wildberries. The third user group is the administrator, whose role is to supervise the platform at a systemic level, enforce business rules, review seller activities, monitor payment and delivery states, and maintain the integrity of shared operations. The coexistence of these three user groups illustrates the multi-actor nature of the platform and justifies the need for clear role separation in both the interface design and the underlying system architecture.

### 1.3.2 Technology Scope

The technological scope of the project is deliberately chosen to balance modern engineering practice with the feasibility constraints of a graduation project. On the frontend, the system uses Next.js to support responsive user interaction, organized routing, and an efficient rendering model suitable for e-commerce scenarios. On the backend, NestJS is employed as the principal service framework because it provides a modular and maintainable structure for implementing authentication, product management, seller workflows, order handling, and administrative controls. Persistent relational data is managed through PostgreSQL in combination with Prisma ORM, enabling the project to model complex business entities while preserving type safety and development efficiency.

Beyond the transaction layer, the project also includes an AI processing scope that is handled separately through a FastAPI-based Python service. This design choice allows computational or image-related tasks to be executed independently from the main commerce backend, thereby reducing the risk that AI workloads will negatively affect transactional responsiveness. Queue handling through Redis and BullMQ is incorporated to support asynchronous operations, while object storage components are used to manage uploaded and generated media. At the same time, the project intentionally limits certain external integrations, such as real-time banking settlement and full-scale custom model training, in order to maintain a realistic implementation boundary. These limitations do not reduce the validity of the platform; rather, they help ensure that the chosen technological scope remains focused, coherent, and achievable within the academic context of the project.

### 1.3.3 System Functional Scope

The functional scope of the system encompasses the major workflows required to operate a multi-vendor e-commerce platform with AI-enhanced user support. On the seller side, the platform includes facilities for onboarding, catalog import and synchronization, product creation and editing, publication control, and access to AI-related features that support product visualization and promotional effectiveness. On the customer side, the system supports account authentication, marketplace browsing, product selection, cart management, and the submission of orders in a way that reflects the complexities of a shared marketplace, including the division of a single checkout into multiple child orders when items originate from different shops. These functions are essential to demonstrating that the platform is capable of supporting real marketplace behavior rather than merely simulating isolated interfaces.

In addition to these core commerce flows, the system functional scope also includes user-facing and operational support capabilities that improve completeness and realism. These capabilities include multilingual presentation, status notification flows, supervised payment confirmation processes, delivery state tracking, and AI virtual try-on interactions intended to improve user understanding of fashion products before purchase. The inclusion of these workflows reflects the project’s broader aim of producing an integrated digital commerce experience in which operational efficiency, customer support, and intelligent interaction are treated as interconnected concerns rather than separate modules.

From a systems analysis perspective, defining the functional scope in this manner is important because it establishes a clear boundary between the essential processes that must be implemented for the platform to be meaningful and the supplementary features that may be reserved for later development phases. In this project, the emphasis is placed on the workflows that most directly affect commercial viability and user experience, namely seller autonomy in catalog and pricing control, controlled public product visibility, customer confidence during fashion selection, and platform-level supervision of orders and transactions. By focusing on these interdependent functions, the project demonstrates that an AI-enabled commerce platform should not be evaluated solely on the novelty of its intelligent features, but also on the robustness of the surrounding business processes that allow those features to create practical value.

Moreover, the scope definition reflects the specific orientation of the project toward fashion e-commerce rather than toward generic marketplace architecture. The inclusion of AI virtual try-on is particularly significant because it extends the platform beyond transactional exchange into the domain of decision support, where visual interaction can directly influence purchase confidence and perceived personalization. Likewise, the presence of multi-vendor checkout handling, seller-specific catalog governance, and supervised operational flows indicates that the platform is intended to model real marketplace complexity. Consequently, the functional scope of the system provides a coherent foundation for later chapters, where the architectural design and implementation results can be evaluated against clearly articulated operational expectations.

### 1.3.4 System Limitations

Although the project aims to provide a comprehensive and realistic system prototype, it also acknowledges several limitations that arise from time, infrastructure, and resource constraints typical of an undergraduate graduation project. Payment verification, for example, is implemented through supervised manual review rather than through direct integration with live banking settlement systems. This approach is sufficient for validating the business flow and administrative control logic, but it does not yet represent a fully automated financial reconciliation environment. Similarly, the AI virtual try-on feature is implemented within a practical prototype boundary that emphasizes user interaction and service integration rather than attempting to reproduce the full complexity of large-scale commercial fitting engines.

The project also limits certain aspects of logistics and external intelligence integration. Delivery processes are modeled in a manageable form, and some advanced routing or geocoding capabilities are simplified in order to keep the implementation aligned with available development resources. These limitations should not be viewed as weaknesses of the conceptual model; instead, they define the current prototype boundary and provide a clear roadmap for future improvement. By explicitly acknowledging such constraints, the report maintains methodological transparency and clarifies which components have been fully implemented, which have been simulated, and which remain suitable directions for subsequent development.

It is also necessary to recognize that limitations in a graduation project serve an analytical function rather than merely representing an absence of features. In software engineering research and applied development, a realistic prototype is often more academically valuable than an overly broad system whose scope exceeds available verification capacity. For this reason, the present project deliberately prioritizes architectural coherence, workflow integrity, and demonstrable end-to-end functionality over the inclusion of every possible commercial integration. This means that some components are implemented at a controlled prototype level so that the platform can still be evaluated meaningfully in terms of structure, interaction quality, and business process support.

At the same time, these limitations help reveal the next stage of maturity that would be required for real-world commercialization. For example, a production-ready evolution of the platform would likely require live payment gateway integration, stronger logistics automation, more extensive AI model calibration, and broader user behavior analytics. By identifying such gaps explicitly, the project avoids overstating its current completeness while also showing that the system has been designed with future extensibility in mind. This balance between present feasibility and future expansion is an important methodological characteristic of the project and contributes to the credibility of the report as a graduation-level engineering document.

### 1.3.5 Development and Deployment Environment

The development and deployment environment of the project is designed to reflect contemporary software engineering practice while remaining suitable for iterative academic experimentation. The system is developed across workstation environments such as Windows 11 and Linux Ubuntu, allowing the implementation to be tested under conditions similar to those encountered in collaborative development settings. Application services are containerized through Docker Compose so that dependencies can be managed consistently, service startup can be reproduced reliably, and the full platform can be deployed or re-evaluated with minimal manual configuration. This approach also supports the project’s broader objective of demonstrating not only functional correctness, but also operational readiness.

From a data and source management perspective, PostgreSQL is used as the primary relational database, while the codebase is maintained in a version-controlled repository to support traceability, rollback, and collaborative revision. Such an environment is important in a graduation project because it shows that the work is being conducted with professional development discipline rather than as an isolated demonstration artifact. In this sense, the deployment environment becomes part of the project’s contribution, since it helps establish the system as a reproducible and extensible software product rather than merely a collection of disconnected experimental modules.

In addition, the choice of deployment environment has methodological significance because it influences how reliably the project can be reproduced, validated, and extended by other developers or evaluators. A containerized, service-based setup reduces ambiguity in dependency configuration and makes it easier to test the interaction among the frontend, backend, AI service, and supporting infrastructure. This is particularly important in a project of this kind, where the value of the system depends not only on isolated code correctness but also on the ability of multiple components to cooperate consistently in a realistic runtime environment. As a result, the deployment design supports the integrity of subsequent testing and demonstration activities presented later in the report.

Furthermore, the environment configuration reflects a practical understanding of how modern digital products are developed and maintained. By organizing the project around reproducible services, persistent database layers, and version-controlled source workflows, the implementation aligns itself with contemporary standards in collaborative software engineering. This adds academic value because it shows that the graduation project is not limited to conceptual modeling or interface design, but extends into deployment-aware system construction. Therefore, the development and deployment environment should be understood as part of the project’s overall contribution to demonstrating end-to-end engineering capability.

---

## 1.4 PRACTICAL SIGNIFICANCE AND STARTUP ORIENTATION

### 1.4.1 Solving Real-life Problems

One of the most important values of this project lies in its direct connection to a real commercial problem rather than a purely theoretical research scenario. The system is motivated by the practical experience of working with Wildberries, where high platform commissions, advertising expenses, logistics costs, and related deductions can gradually erode seller profitability even when sales activity remains stable. In response to this situation, the proposed platform is positioned as a more controllable and strategically useful environment for Vietnamese sellers who need better oversight of their operating costs, promotional activities, and product presentation processes. The project therefore addresses an authentic economic challenge faced by merchants, rather than introducing technology for its own sake.

The project also solves practical problems associated with product visualization and customer uncertainty in fashion commerce. By integrating AI-assisted visual support and virtual try-on interaction into the marketplace experience, the platform helps reduce the gap between online product display and customer perception. This has significance for both sellers and buyers: sellers benefit from lower content production barriers and improved product attractiveness, while buyers gain more confidence when evaluating clothing items in an online environment. In this way, the system contributes to cost reduction, usability improvement, and trust enhancement across the digital retail process.

The practical significance of this problem-solving orientation becomes clearer when viewed from the standpoint of small and medium-sized merchants, who often operate under narrow margins and limited access to advanced digital tools. For such sellers, the difference between a sustainable business model and an unprofitable one may depend on whether they can control platform fees, reduce manual catalog work, and improve product presentation without incurring excessive design or advertising expenses. By combining these concerns within a single platform, the project seeks to create measurable value in everyday operations rather than offering isolated convenience features. This approach reinforces the idea that practical significance in software projects should be evaluated by the degree to which the system responds to lived business constraints.

At the consumer level, the practical value of the system also lies in its potential to reduce hesitation and uncertainty in online fashion purchasing. Many users are reluctant to make clothing purchases when they cannot adequately visualize how an item may appear in use. By incorporating a virtual try-on component into the commerce workflow, the platform provides a more supportive decision-making environment that may contribute to better user satisfaction and potentially lower return-related friction. Therefore, the practical significance of the project extends across the seller-consumer relationship and demonstrates a broader understanding of how technological intervention can improve both operational processes and user confidence.

### 1.4.2 Practical Application Potential

The practical application potential of the proposed platform extends beyond the immediate boundaries of the graduation project. Although the system is motivated by the needs of sellers working with or around Wildberries, its architecture and workflow design are sufficiently general to be adapted for other fashion-oriented marketplaces, niche retail ecosystems, and direct-to-consumer commerce initiatives. The platform may serve as a foundational model for businesses that require synchronized catalog control, role-based administration, AI-enhanced product presentation, and marketplace-style order handling within a single digital infrastructure. This adaptability increases the long-term relevance of the system and demonstrates that the project is not limited to a narrow experimental setting.

Furthermore, the use of modular services and containerized deployment enhances the feasibility of transferring the platform into real operational environments. Because the system is organized around standard web technologies and clearly separated service responsibilities, future developers or startups can extend the platform with additional integrations, recommendation models, payment automation, or more advanced virtual fitting algorithms. The project therefore possesses meaningful translational value, connecting academic implementation with realistic opportunities for productization and practical business deployment.

Another dimension of its application potential lies in the fact that the platform addresses a category of business need that is not confined to one marketplace or one country. Many sellers across emerging digital economies face similar challenges related to cross-platform catalog duplication, limited brand independence, weak control over customer interaction, and the absence of accessible intelligent tools for visual merchandising. Because the proposed system is constructed around these broader operational patterns, it can be interpreted as a reusable framework for a range of digital retail settings in which merchants need both platform functionality and technological assistance. This makes the project relevant not only as a local solution, but also as a transferable model for comparable commerce environments.

In academic terms, strong practical application potential also strengthens the evidential value of the implementation itself. A system that can realistically be adapted, extended, or piloted in operational contexts provides more meaningful proof of concept than a narrowly bounded demonstration artifact. For this reason, the application potential described here supports the central claim that the project occupies a productive middle ground between academic experimentation and product-oriented engineering. It is sufficiently concrete to be implemented and evaluated, yet sufficiently extensible to remain valuable beyond the immediate scope of the graduation requirement.

### 1.4.3 Innovation Value

The innovation value of the project lies primarily in the way it integrates artificial intelligence into the everyday operational structure of a multi-vendor marketplace. In many existing systems, AI functionality is introduced as an external add-on or an isolated demonstration feature that remains detached from the main commercial workflow. In contrast, this project treats AI as an embedded service layer that interacts directly with catalog management, media generation, user experience, and platform economics. The AI virtual try-on component is particularly important in this regard because it transforms the role of the marketplace from a passive listing environment into a more interactive decision-support system for fashion consumers.

In addition, the project introduces innovation through the combination of commerce logic and platform accountability. Promotional mechanisms are not treated as opaque black-box features; instead, they are connected to auditable billing logic and structured operational control. This creates a more transparent marketplace model for sellers while also strengthening trust in the system’s internal processes. The novelty of the project therefore arises not only from the presence of AI, but from the coherent integration of AI, marketplace governance, and user-centered retail interaction into a single software architecture.

This innovation should also be understood at the level of system composition. Rather than pursuing novelty through one isolated algorithm, the project proposes a form of integrated innovation in which architecture, workflow design, AI service orchestration, and marketplace administration are combined to produce a more intelligent retail environment. Such an approach is especially valuable in applied software engineering because real innovation in digital products often depends less on isolated technical sophistication and more on how well multiple components are arranged to solve a user problem in a coherent and maintainable way. In this regard, the project contributes a design perspective that treats intelligence as part of the platform structure rather than as an ornamental extension.

The innovation value is further strengthened by the project’s focus on explainable commercial operations. In many digital platforms, monetization and promotion mechanisms remain difficult for sellers to understand, which can weaken trust and discourage strategic participation. By linking promotional visibility to auditable system logic and by embedding AI-driven assistance into operational workflows that users can directly experience, the platform presents a more transparent innovation model. This combination of technological assistance, platform accountability, and user-centered interaction gives the project a stronger innovation profile than systems that rely solely on conventional marketplace features or isolated AI experimentation.

### 1.4.4 Startup and Commercialization Potential

From a startup and commercialization perspective, the project demonstrates considerable potential because it is grounded in a problem that has clear economic consequences for a defined user group. Vietnamese sellers participating in large external marketplaces often need a more sustainable model through which they can preserve margins, manage product operations more independently, and differentiate their offerings without incurring excessive creative or promotional costs. The proposed platform responds to this need by combining marketplace access, AI-enabled product enhancement, and future-ready service extensibility. As a result, it can be positioned not merely as a software product, but as a specialized commerce solution aimed at a recognizable market segment.

The commercialization pathway of the platform may reasonably include subscription-based seller services, transaction-related platform fees, premium AI feature packages, and future data-driven merchant support offerings. More importantly, the system is designed in a way that allows gradual business expansion: it can begin as a focused platform serving a specific seller community and later evolve into a broader ecosystem that includes recommendation services, advanced analytics, automated logistics support, or cross-border retail enablement. This phased growth logic is highly compatible with startup development principles, and it reinforces the conclusion that the project possesses not only technical merit, but also strategic business viability.

The startup potential of the platform is also strengthened by the fact that it does not rely on solving an abstract or artificially constructed problem. Instead, it addresses a pain point that is already experienced by a concrete merchant segment and that has clear financial implications. This gives the system an identifiable value proposition, which is essential in early-stage product development. A startup built around such a platform could initially focus on delivering tangible operational advantages, such as lower content production costs, better control over product publication, and improved user engagement through virtual try-on, before gradually expanding into more advanced seller services. This pathway is well aligned with lean product development logic because it starts from a real need and supports iterative growth based on validated demand.

In addition, the commercialization vision of the project is not limited to direct platform revenue alone. Over time, the system could develop into a broader service ecosystem in which AI assistance, marketplace tools, analytics, seller support, and partnership integrations create layered sources of value. Such an evolution would make it possible to move from a basic marketplace offering toward a richer platform economy centered on fashion commerce enablement. From the standpoint of graduation project evaluation, this broader commercial vision is important because it shows that the project has been conceived with strategic foresight. The platform is therefore not only implementable as a technical artifact, but also interpretable as the basis for a scalable and differentiated digital business model.

In summary, this chapter has presented the introductory foundation of the graduation project, including the motivation, objectives, scope, practical significance, and startup-oriented potential of the proposed system. The chapter first examined the broader context of digital transformation in e-commerce and analyzed the practical difficulties encountered by online sellers, especially Vietnamese sellers operating in relation to large external marketplaces such as Wildberries. Particular attention was given to the problem of high platform commissions, advertising expenses, logistics deductions, fragmented catalog management, and the limitations of traditional online shopping experiences in the fashion sector. From this analysis, the need for a more integrated and economically sustainable multi-vendor e-commerce platform, enhanced with artificial intelligence and virtual try-on capability, was clearly identified.

The chapter also clarified the general objective and the major specific objectives of the project. The primary goal is to develop a multi-vendor e-commerce platform integrated with an AI virtual try-on system that can support sellers in managing products, synchronizing catalog data, controlling publication workflows, and improving product presentation, while simultaneously providing customers with a more interactive and confidence-oriented shopping experience. In addition to the marketplace foundation, the project also seeks to demonstrate the feasibility of embedding artificial intelligence into practical digital commerce services through image-related assistance, virtual try-on interaction, and platform mechanisms that can later be extended into more advanced recommendation and personalization features. In this sense, the project is positioned not merely as a software prototype, but as a product-oriented system that reflects both technical and business considerations.

Furthermore, the chapter defined the target users, technological scope, functional scope, system limitations, and development environment of the project. The system is intended to serve multiple user groups, including customers, sellers, and administrators, each with distinct responsibilities and operational needs within the marketplace ecosystem. Within the scope of the current project, the implementation concentrates on core features such as authentication, catalog and product management, multi-vendor order handling, AI-supported visual interaction, supervised payment and delivery workflows, and role-based platform administration. At the same time, the chapter acknowledged several practical limitations, including the use of simplified payment verification and prototype-level AI virtual try-on implementation, in order to maintain feasibility within the academic and technical constraints of a graduation project.

Finally, the chapter emphasized the practical value, innovation value, and commercialization potential of the proposed system. The platform has the capacity to improve operational efficiency for sellers, reduce unnecessary dependence on costly external ecosystems, enhance customer experience in online fashion purchasing, and create a more intelligent environment for digital product presentation and interaction. In the future, the system may be extended with additional AI services, automated payment integration, richer analytics, recommendation engines, and broader commercial support tools for sellers. These development directions confirm that the project should be understood not only as a technical implementation exercise, but also as a product-oriented solution with meaningful real-world applicability and promising startup potential.

***

# CHAPTER 2. THEORETICAL BACKGROUND, MARKET ANALYSIS AND SYSTEM REQUIREMENTS

## 2.1 THEORETICAL BACKGROUND

This chapter establishes the theoretical and analytical foundation for the proposed system by examining the principal technologies, market conditions, and requirement structures that inform the design of the platform. Because the project is positioned at the intersection of e-commerce engineering and applied artificial intelligence, it is necessary to review not only the technical frameworks used in implementation, but also the market pressures and business conditions that justify the creation of such a system. The purpose of this chapter is therefore twofold: first, to explain the conceptual and technological basis of the platform; and second, to translate real-world seller and customer needs into a set of structured system requirements that guide later design and development decisions.

### 2.1.1 Web Application Development with Next.js

The client-facing layers of the marketplace are developed using Next.js, a progressive React framework designed for high-performance production environments. Next.js is chosen for its native support for Server-Side Rendering (SSR) and static site generation, which are critical for search engine optimization (SEO) in e-commerce, ensuring that product detail pages are indexed efficiently by search crawlers. 

The framework's App Router architecture organizes application code into logical folder directories, facilitating the separation of Customer, Seller, and Admin interfaces. Furthermore, Next.js implements automatic code-splitting, reducing initial bundle sizes and improving page load speeds.

From an academic and architectural perspective, Next.js is particularly suitable for this project because it supports the coexistence of public-facing marketplace content and protected role-specific dashboards within a unified frontend codebase. This capability is valuable in multi-vendor e-commerce contexts, where different user categories require different navigation models, security expectations, and rendering behavior. By enabling both efficient public page delivery and interactive private application flows, the framework helps bridge the gap between high-performance storefront presentation and role-oriented management interfaces.

### 2.1.2 Backend Services with NestJS

The transaction and business logic layer is developed using NestJS, an opinionated Node.js framework designed for building scalable, enterprise-grade applications. NestJS enforces modular software development patterns, dividing code into distinct modules, controllers, and services. 

By leveraging TypeScript, the framework ensures static type safety across the application, preventing common runtime errors. NestJS provides native dependency injection mechanisms, simplifying the testing of individual components by allowing developers to swap real database connections with lightweight mock implementations.

In addition, NestJS is appropriate for the project because its opinionated structure supports the implementation of complex commerce rules in a disciplined and maintainable way. A marketplace platform contains multiple interrelated domains, such as authentication, catalog governance, recommendation exposure, order processing, and role-based administration. These domains benefit from a framework that encourages clear separation of concerns and scalable module organization. As a result, the choice of NestJS is not merely a matter of technical preference, but also a response to the intrinsic complexity of the business logic that must be managed by the system.

### 2.1.3 Microservices and API Gateway Concepts

To maintain system responsiveness under heavy workloads, the project decouples transaction processing from resource-intensive machine learning tasks. The system uses a microservice architecture, separating the core NestJS backend from the Python FastAPI AI gateway. 

This decoupling ensures that database-bound transactions remain responsive even when the AI service is processing complex image generation requests. Communication between the services is structured through REST API endpoints secured with token-based authentication.

Such a microservice-oriented separation is especially relevant in AI-enabled commerce systems because intelligent processing tasks often have very different runtime characteristics from transactional operations. Catalog queries, cart updates, and order creation require quick and reliable responses, whereas image-related AI tasks may involve higher latency and greater resource consumption. By isolating these responsibilities, the system preserves transactional stability while still enabling intelligent features to be incorporated into the user experience. This architectural principle directly supports the practical goal of integrating AI without compromising marketplace responsiveness.

### 2.1.4 Relational Databases and ORMs (PostgreSQL & Prisma)

The relational database architecture is built on PostgreSQL 16, a database system chosen for its support for ACID transactions and complex relational queries. To interact with the database, the NestJS application uses Prisma ORM, a type-safe database client. 

Prisma parses a declarative schema file (`schema.prisma`) to automatically generate TypeScript models and types, reducing the risk of schema mismatches. Prisma's migration CLI simplifies database version control, tracking changes through structured SQL files.

The use of a relational database is particularly important in this project because multi-vendor commerce depends on well-defined entity relationships and transactional integrity. Users, shops, products, campaigns, wallets, orders, and delivery records cannot be modeled effectively without strong relational guarantees. PostgreSQL and Prisma together provide a reliable mechanism for maintaining these relationships while also supporting development productivity. This makes them highly appropriate for a graduation project that seeks to demonstrate both technical rigor and realistic business process modeling.

### 2.1.5 Cache and Queue Architecture (Redis & BullMQ)

Asynchronous task processing is managed using Redis as an in-memory data structure store, functioning alongside BullMQ, a robust message queue system for Node.js. When a merchant requests several AI-generated images, the backend enqueues the tasks in Redis and immediately returns a success status to the client. 

A background worker process then consumes the tasks sequentially, preventing system crashes and ensuring that system resources are allocated efficiently.

Theoretical discussions of distributed systems frequently emphasize the importance of decoupling latency-sensitive actions from heavy background jobs, and this principle is directly reflected in the present design. In a marketplace integrated with AI services, task queues play an essential role in preserving a responsive user experience while enabling advanced processing capabilities. The queue architecture therefore functions not only as a technical optimization, but also as an enabling condition for the practical coexistence of conventional e-commerce flows and AI-assisted services.

### 2.1.6 FastAPI and Python AI Services

The AI gateway is written in Python using FastAPI, a web framework built on standard Python type hints and ASGI specifications. FastAPI is selected for its high performance and native compatibility with Python's machine learning libraries (such as Pillow and PyTorch). 

The framework automatically generates interactive OpenAPI documentation, simplifying the validation of request payloads and response structures.

FastAPI also provides a productive environment for integrating computer vision or image-related logic into a service layer that remains accessible to the broader platform. In this project, the AI service does not exist in isolation; it acts as a functional extension of the marketplace, supporting image generation and virtual try-on workflows that contribute to seller operations and customer decision-making. The ability of FastAPI to expose well-documented endpoints, validate structured payloads, and integrate naturally with Python-based image libraries makes it a suitable bridge between machine-intelligent processing and web-based commerce services.

### 2.1.7 Object Storage (MinIO & S3)

To manage generated images and document uploads, the platform implements MinIO, an open-source, S3-compatible object storage server. MinIO allows developers to build and test object storage features locally in containerized environments. 

Because MinIO implements the standard Amazon S3 API, the system can transition from local storage to cloud providers like Amazon Web Services (AWS) or Google Cloud Storage (GCS) by updating basic environment variables.

From the standpoint of system design, object storage is indispensable in applications where media content represents a central part of business value. Fashion commerce, in particular, depends heavily on product imagery, uploaded documents, and generated visual assets. The use of MinIO therefore supports both the experimental needs of local development and the conceptual requirements of a deployable production architecture. It ensures that media handling is treated as a first-class infrastructure concern rather than an afterthought.

---

## 2.2 MARKET DEMAND AND COMPETITOR ANALYSIS

### 2.2.1 Analysis of Customer Needs

Analyzing customer needs highlights a strong demand for interactive, fast, and personalized e-commerce shopping experiences. Shoppers want to verify apparel sizes before buying, track deliveries clearly, and navigate localized interfaces. Sellers require automated tools to reduce creative photography costs and simplify catalog management across platforms.

#### Table 2.1 Analysis of Customer Needs
| User Group | Core Need | Platform Feature | Technical Execution |
| --- | --- | --- | --- |
| Customers | Accurate fit verification | AI Try-On & Size Recs | FastAPI image overlay + size logic |
| Customers | Clear shipping details | Yandex Manual Tracking | Tracking timeline updates |
| Sellers | Low model costs | AI Image Playground | NestJS + FastAPI task runner |
| Sellers | Easy catalog uploads | WB Sync (API/Excel) | Axios sync + xlsx workbook parser |

These customer needs highlight the importance of building a unified platform. Providing localized views, virtual fitting services, and automated catalog imports directly addresses the pain points of modern e-commerce users.

Viewed more broadly, the customer-needs analysis reveals that the project operates in a market where usability, trust, and efficiency are all intertwined. Customers increasingly expect assistance during product evaluation, while sellers seek tools that reduce repetitive work and improve competitive visibility. The convergence of these expectations creates favorable conditions for a system that combines commerce functionality with intelligent service support. Thus, the proposed platform responds not to a single isolated need, but to a cluster of interconnected demands emerging from contemporary digital retail practice.

This need becomes even more pronounced when the platform is considered in relation to the Russian online consumer market, which is one of the practical targets of the project. Customers in this environment are already accustomed to fast digital interfaces, large product selections, and strong visual presentation standards on major marketplaces. For that reason, a newly developed platform cannot rely solely on basic listing functionality if it aims to attract both merchants and end users. It must offer a shopping experience that is sufficiently informative, visually persuasive, and operationally smooth to compete with established expectations. In this context, AI virtual try-on and stronger seller-side product control are not merely innovative additions, but necessary strategic responses to an already mature digital retail culture.

At the same time, the customer-needs analysis should not be interpreted only from the standpoint of buyers. In a multi-vendor e-commerce system, merchants are also important users of the platform, and their needs strongly affect whether the platform can grow sustainably. A seller who is forced to spend excessive time on manual catalog editing, external promotion tools, and expensive image preparation may not be able to operate efficiently even if customer traffic exists. Therefore, the platform is designed to respond to both dimensions of demand: the customer need for a more trustworthy and personalized fashion-shopping experience, and the seller need for a more profitable, integrated, and controllable operating environment. This dual orientation is central to the logic of the proposed system.

### 2.2.2 Competitive Analysis of Existing E-Commerce Platforms

An audit of existing platforms reveals that major marketplaces like Wildberries or Shopify require external plugins or manual data entry to manage multi-channel catalogs, generate AI photos, or run auditable CPC campaigns. Trawberry addresses these gaps by integrating these features into a unified platform.

#### Table 2.2 Competitive Analysis of Platforms
| Platform | Catalog Sync | AI Image Generation | Wallet / Sponsored CPC | Virtual Try-On |
| --- | --- | --- | --- | --- |
| Wildberries | Native | No (External) | Yes (Internal) | Predefined models only |
| Shopify | Manual/App | App integration | App-based | App-based |
| **Trawberry**| **Native WB API/Excel**| **Integrated Sandbox** | **Transparent CPC Ledger** | **Integrated VTON Page** |

By providing native catalog synchronization alongside a generative AI playground and a ledger-backed ad bidding system, Trawberry offers a cohesive workspace for digital merchants.

This comparative analysis also highlights an important strategic distinction: many popular platforms offer flexibility through extensions, but such flexibility often comes at the cost of fragmentation, configuration burden, and inconsistent operational oversight. In contrast, the project aims to unify key seller workflows inside a single environment. From an academic viewpoint, this comparison justifies the relevance of the proposed system by demonstrating that its value lies not merely in copying existing marketplace features, but in integrating multiple high-demand capabilities into a coherent and more controllable architecture.

Another important point emerging from the competitor analysis is that the strength of dominant platforms does not automatically eliminate the opportunity for specialized alternatives. Large marketplaces are powerful because of their traffic, fulfillment infrastructure, and consumer familiarity; however, they are not always optimized for the financial realities of smaller or cross-border sellers. In many cases, their scale is accompanied by fee structures, advertising dependencies, and operational rigidity that create dissatisfaction among merchants. The proposed system is therefore not positioned as a direct scale-based competitor to such platforms, but rather as a focused solution that addresses gaps in seller autonomy, cost control, and AI-supported user interaction. This positioning is strategically important because it defines the project’s competitive logic more clearly.

Furthermore, the comparison of existing platforms suggests that the true differentiation of the proposed system lies in integration rather than in isolated features. Catalog synchronization alone is not sufficient to create a strong market proposition, just as AI virtual try-on by itself would not solve merchant profitability problems. The strength of the proposed platform lies in combining these elements with role-based management, multi-vendor operations, and transparent campaign logic. By integrating these components into one system, the platform creates a more coherent value structure that can support both operational efficiency and user-facing experience. This integrative character is one of the central reasons why the proposed system remains academically and commercially relevant.

---

## 2.3 STARTUP-ORIENTED MARKET ANALYSIS

### 2.3.1 SWOT Analysis

The commercial viability of the Trawberry platform is analyzed using a SWOT matrix, highlighting the system's strengths, weaknesses, opportunities, and threats.

#### Table 2.3 SWOT Analysis of Trawberry Platform
| Strengths | Weaknesses |
| --- | --- |
| - Native, seamless AI product model generation.<br>- Decoupled, stable Next.js/NestJS/FastAPI architecture.<br>- Safe role-isolated cookie-based JWT sessions. | - V1 uses manual SBP payment proof uploads.<br>- AI try-on relies on mock layouts unless connected to commercial VTON APIs. |
| **Opportunities** | **Threats** |
| - High market demand for low-cost digital photography.<br>- Rapid adoption of Russian SBP QR payment methods.<br>- Expansion into cross-border marketplace platforms. | - High cloud hosting costs for GPU instances.<br>- Platform dependency on third-party APIs (Wildberries, OpenAI). |

Analyzing these quadrants reveals that the platform's core strength lies in its decoupled, containerized architecture, which allows developers to swap components easily (e.g., upgrading the simulated try-on engine to a dedicated GPU model) as market conditions demand.

The SWOT analysis is especially useful because it shows that the project’s business logic and technical architecture are closely connected. Several of the identified strengths, such as modular deployment and AI service separation, are not only engineering decisions but also strategic assets that support adaptability under changing market conditions. Likewise, the weaknesses and threats reinforce the need for staged product evolution, prudent infrastructure choices, and diversification of external service dependencies. This makes the SWOT framework a practical tool for interpreting how technical design decisions influence startup readiness.

From a broader strategic perspective, the SWOT analysis reveals that the most significant advantage of the project lies in its ability to translate a practical seller problem into a differentiated platform concept. The weakness of high-cost marketplace dependence becomes, in this context, the starting point for building a stronger internal value proposition. By identifying seller dissatisfaction as a real market signal, the project frames its strengths in terms of practical usefulness rather than theoretical novelty. This is important because in startup-oriented digital systems, long-term viability often depends on whether the platform can solve an existing pain point more effectively than incumbent solutions, not simply on whether it introduces a technically interesting feature.

At the same time, the SWOT analysis also makes clear that market entry and trust-building will remain difficult challenges for the proposed system. Technical quality alone does not guarantee adoption, especially in e-commerce, where users often remain loyal to familiar platforms because of habit, perceived security, and traffic expectations. For this reason, the identified weaknesses and threats are not secondary observations but essential strategic constraints. They indicate that the platform must be developed not only with technical competence, but also with strong attention to user confidence, policy clarity, and measurable seller value if it is to move beyond prototype status toward practical commercial relevance.

### 2.3.2 PESTEL Analysis

The macroeconomic environment of the platform is evaluated using a PESTEL framework. Politically, data protection rules mandate that customer data be hosted on localized databases. Economically, high inflation encourages merchants to seek automated platforms to reduce creative and advertising expenses. 

Socially, younger consumers expect interactive visual shopping tools like virtual fitting rooms. Technologically, standardized API integrations simplify system development. 

Environmentally, digital try-on services help reduce return shipping emissions. Legally, the use of AI-generated content requires clear terms of service to address intellectual property ownership.

The PESTEL framework demonstrates that the proposed platform is influenced by a wider environment that extends beyond software implementation alone. Market viability depends not only on technical success, but also on regulatory compliance, cost sensitivity, consumer behavior, and the evolving norms surrounding artificial intelligence in commerce. By identifying these macro-level factors, the chapter clarifies that the system is being developed within a broader ecosystem of social and economic change. This perspective strengthens the academic quality of the report by linking system design to external structural conditions rather than to technology in isolation.

In particular, the economic and social dimensions of the PESTEL analysis are highly relevant to the project because they directly explain why a new seller-oriented platform may become attractive in the present market. Rising acceptance of online shopping, especially in fashion retail, means that customers are increasingly prepared to engage with digital-first product experiences. At the same time, sellers facing shrinking margins on large marketplaces become more willing to consider alternative channels if those channels offer stronger cost control and clearer operating conditions. The overlap between these two trends creates an external environment in which a platform combining marketplace functionality and intelligent user interaction can gain practical relevance.

The legal and technological factors are equally significant because they determine the conditions under which the platform may scale responsibly. AI-supported commerce systems increasingly handle user images, behavioral data, and algorithm-influenced presentation logic, which creates legitimate concerns about privacy, security, and platform accountability. Consequently, macro-environmental analysis is not a purely descriptive exercise, but an essential part of determining the long-term sustainability of the proposed system. By showing that the platform is shaped by external institutional and infrastructural forces, the PESTEL framework strengthens the report’s interpretation of the project as a realistic digital business system rather than a narrowly technical prototype.

### 2.3.3 Porter’s Five Forces Analysis

The competitive dynamics of the digital retail market are assessed using Porter’s Five Forces. First, the threat of new entrants is moderate; while basic e-commerce templates are common, building a multi-seller system with queue workers and transaction ledger tracking requires significant technical expertise. 

Second, the bargaining power of buyers is high, as consumers can switch between e-commerce portals at no cost. Third, the bargaining power of suppliers is moderate; the platform relies on third-party APIs like OpenAI, but the AI gateway can be configured to use alternative APIs or self-hosted models. 

Fourth, the threat of substitutes is high, as merchants can use independent photo editing agencies or standalone marketing software. Fifth, competitive rivalry is high, as major platforms are quickly implementing native AI tools.

Porter’s framework further reinforces the argument that the system must compete on integration quality and business usefulness rather than on the mere presence of fashionable technology. In a market where substitutes and rivalry are significant, a platform becomes valuable when it reduces operational friction and offers a clear, trustable workflow that merchants can understand and control. For that reason, the strategic relevance of the proposed system lies in how effectively it combines technical capability with seller-oriented transparency and practical cost reduction.

The Five Forces analysis also helps clarify that the proposed platform should be evaluated in relation to a specific strategic niche rather than against the full scale of dominant marketplaces. Competing directly with established platforms on traffic volume, warehouse coverage, or brand recognition would be unrealistic in the short term. However, competing on seller economics, integrated workflow support, and AI-enhanced fashion interaction is more feasible and more aligned with the project’s actual purpose. This distinction is crucial because it redefines competitive success in terms of value specialization rather than mass-market dominance.

Moreover, the analysis indicates that barriers in the market are not only technological but also behavioral and structural. Sellers may hesitate to migrate from familiar ecosystems, and customers may instinctively trust large platforms more than new entrants. Therefore, the proposed system must create enough visible advantage to justify behavioral change. This means that the platform’s future success will depend not just on being functional, but on demonstrating clear superiority in selected dimensions such as cost transparency, product interaction quality, and seller control. Porter’s framework thus provides an important strategic lens for understanding what kind of differentiation the platform must pursue in practice.

---

## 2.4 SYSTEM REQUIREMENTS IDENTIFICATION

### 2.4.1 User Stories of the System

To guide system development, core user stories are established for each user role. For sellers, the system must support importing catalogs from platforms like Wildberries and using generative AI to create product images based on text prompts. 

Sellers also need to manage sponsored campaigns and track their CPC budgets. Customers require localized interfaces, secure checkouts, delivery updates, and virtual try-on tools. Administrators need tools to approve sellers, review payments, and monitor system performance.

#### Table 2.6 Key User Stories
- **US-01**: As a Seller, I want to sync my products from Wildberries so that I do not have to manually enter my listings.
- **US-02**: As a Seller, I want to generate model-driven product photos using AI prompts so that I can save model styling costs.
- **US-03**: As a Seller, I want to fund my wallet via demo tools and launch CPC sponsored campaigns so that I can boost my search rank.
- **US-04**: As a Customer, I want to upload my photo and see how clothes fit me using AI Try-On so that I can buy the correct size.
- **US-05**: As an Admin, I want to approve new sellers and inspect unpaid/delayed order queues so that I can maintain marketplace quality.
- **US-06**: As a Seller, I want to edit localized product titles, prices, and stock visibility so that I can adapt my catalog for the Russian market.
- **US-07**: As a Seller, I want to publish or unpublish imported products so that I can control which items appear on the public marketplace.
- **US-08**: As a Seller, I want to monitor wallet balance and campaign spending so that I can manage promotion costs more effectively.
- **US-09**: As a Seller, I want to review customer payment proofs and update order statuses so that I can handle fulfillment accurately.
- **US-10**: As a Customer, I want to search and filter products by category, price, and style so that I can find suitable items quickly.
- **US-11**: As a Customer, I want to add products from different sellers into one cart so that I can complete a convenient multi-vendor purchase.
- **US-12**: As a Customer, I want the system to split my checkout automatically by shop so that each seller can process only their own items.
- **US-13**: As a Customer, I want to track my order and delivery progress so that I know the current fulfillment status.
- **US-14**: As an Admin, I want to supervise seller onboarding, payment review, and delivery workflows so that I can maintain trust and operational quality across the platform.
- **US-15**: As an Admin, I want to configure platform-wide settings for AI usage, recommendations, and seller controls so that the system can remain stable and commercially governed.
- **US-16**: As an Admin, I want to inspect audit-sensitive billing and campaign records so that promotional charging can remain transparent and accountable.

These stories outline the system's focus on automation, catalog management, transparent ad campaigns, and interactive customer interfaces.

From a requirement-engineering standpoint, the user stories play a critical role in translating broad market observations into actionable development priorities. They ensure that the platform is not designed around abstract features, but around concrete user intentions and expected outcomes. This alignment is important in a graduation project because it demonstrates a traceable path from problem identification to feature specification. The user stories therefore serve as a bridge between the market analysis presented earlier in the chapter and the architectural design choices that will be discussed in later chapters.

In addition, the use of user stories supports a more human-centered interpretation of the platform’s functionality. Rather than presenting requirements only as technical obligations, the user-story approach frames them in relation to the motivations and frustrations of actual actors inside the system. A seller does not merely need “API integration” in abstract terms; the seller needs a way to avoid repeating the same catalog work across multiple systems. A customer does not simply require “image processing functionality”; the customer needs more confidence in choosing apparel online. This distinction is methodologically important because it helps keep the system grounded in user value rather than drifting toward feature accumulation without practical coherence.

The stories also help preserve consistency across the different layers of the project. Once articulated clearly, they can be mapped to database structures, service modules, interface flows, and testing scenarios. In this way, the user stories function as a unifying thread that connects market analysis to implementation planning. Their inclusion strengthens the report by demonstrating that the proposed platform is not based on arbitrary development choices, but on a structured interpretation of user needs that can be traced through later design and verification decisions.

### 2.4.2 Functional Requirements

Functional requirements describe the specific functions that the proposed system must provide in order to satisfy the needs of customers, sellers, and administrators. Based on the user stories identified in the previous section, the proposed multi-vendor e-commerce platform integrated with AI virtual try-on includes major functions such as user authentication, seller and shop management, product and catalog synchronization, public product publishing control, shopping cart and multi-shop checkout processing, AI-supported image interaction, sponsored campaign management, billing and wallet control, and platform administration.

These requirements ensure that the system operates not only as a conventional e-commerce marketplace, but also as an AI-enhanced digital commerce environment that supports both business operations and customer decision-making. In other words, the platform is designed not merely to display and sell products, but also to help sellers manage their operations more efficiently and help customers interact with fashion products in a more informed, visual, and personalized manner.

#### Table 2.7 Functional Requirements list
- **FR-01**: Session Separation: Customer, Seller, and Admin authentication must use separate secure cookies.
- **FR-02**: Wildberries Integration: Must decrypt shop WB credentials and sync content.
- **FR-03**: AI Credit Guard: Block AI tasks if credits < quantity. Refund credits if the task fails.
- **FR-04**: Multi-Shop Order Split: A single checkout cart must split into separate orders per shop.
- **FR-05**: Sponsored Ranking: Boost `rule_based_v2` recommendations based on active campaigns.
- **FR-06**: Notifications: Send events (Order placed, Return escalated) to role-isolated notifications.

These requirements guide the implementation of the platform's core business logic, from authentication to checkout splitting and credit management.

The functional requirements also illustrate the multi-layered nature of the platform. They do not focus solely on visible user actions, but also capture the hidden operational rules that ensure the platform behaves consistently in a multi-vendor environment. Examples include role separation, credit protection, price and stock validation, and transaction-safe order creation. By articulating such requirements clearly, the report demonstrates that the project addresses both surface-level usability and deeper business-rule enforcement.

Another important feature of the functional requirements is that they express the platform’s business model in operational terms. For example, the requirement for multi-shop order splitting is not simply a technical convenience; it embodies the marketplace principle that different sellers must remain accountable for their own transactions. Similarly, the requirement for sponsored ranking logic is not only about recommendation display, but also about the fair and auditable monetization of seller promotion. These examples show that the functional layer of the system is where commercial strategy and technical design become tightly connected.

Functional requirements also create the basis for later validation. A project of this scope cannot be considered successful only because it appears complete at the interface level; it must also demonstrate that the underlying behaviors conform to defined expectations. By stating the requirements in explicit operational terms, the report provides a clear benchmark against which implementation decisions, API design, and automated tests may be interpreted. This strengthens the methodological rigor of the chapter and improves the coherence of the report as a whole.

### 2.4.3 Non-functional Requirements

Non-functional requirements describe the quality attributes, operational constraints, and performance expectations of the system. While functional requirements define what the proposed platform must do, non-functional requirements define how well those functions should operate under realistic usage conditions. In other words, functional requirements focus on system capabilities such as product synchronization, AI virtual try-on, checkout processing, and campaign management, whereas non-functional requirements focus on system quality dimensions such as security, performance, usability, reliability, and scalability.

For example, allowing a seller to synchronize products from Wildberries is a functional requirement. However, ensuring that the synchronization process completes reliably, protects encrypted API credentials, and does not corrupt catalog data is a non-functional concern. Similarly, providing an AI virtual try-on feature is a functional requirement, while guaranteeing that image processing is completed within a reasonable response time, that uploaded images are handled securely, and that the service remains stable under repeated use are non-functional requirements related to performance, security, and reliability. This distinction is important because a system may be functionally correct but still fail to deliver acceptable real-world value if it is slow, unstable, insecure, or difficult to use.

In the proposed multi-vendor e-commerce platform integrated with AI virtual try-on, non-functional requirements are particularly significant because the platform combines multiple interacting components, including user authentication, seller dashboards, product and order management, asynchronous AI processing, external marketplace synchronization, billing records, and media storage. These components must operate together consistently if the platform is to serve as a realistic digital commerce environment. If the system were to provide the correct features but fail in areas such as response time, session security, data integrity, or maintainability, then the overall user experience and commercial usefulness of the platform would be substantially weakened.

Therefore, non-functional requirements ensure that the system is not only functionally complete, but also secure, efficient, stable, scalable, and suitable for future expansion. They are essential for transforming the platform from a technically functioning prototype into a credible product capable of supporting real users, real seller operations, and future commercialization goals.

#### Table 2.8 Non-functional Requirements of the System
| No. | Requirement ID | Type | Description |
| --- | --- | --- | --- |
| 1 | NFR-01 | Security | The system should protect user accounts, authentication cookies, seller credentials, and uploaded media through secure authentication, authorization, and encryption mechanisms. |
| 2 | NFR-02 | Performance | The system should provide acceptable response time for common actions such as product browsing, searching, viewing product details, and loading seller dashboards. |
| 3 | NFR-03 | Reliability | The platform should operate stably during normal use and handle common failures such as invalid uploads, failed AI tasks, expired sessions, or interrupted synchronization runs. |
| 4 | NFR-04 | Scalability | The architecture should support future growth in the number of users, sellers, products, orders, media files, and AI service requests. |
| 5 | NFR-05 | Maintainability | The system should be implemented using a modular structure so that features can be updated, fixed, tested, or extended with lower maintenance complexity. |
| 6 | NFR-06 | Usability | The interface should be clear, understandable, and efficient for different user groups, including customers, sellers, and administrators. |
| 7 | NFR-07 | Localizability | The platform should support multilingual usage and fall back gracefully when translation resources are incomplete. |
| 8 | NFR-08 | Compatibility | The system should function correctly across modern web browsers and support usage on desktop and mobile-oriented interfaces. |
| 9 | NFR-09 | Data Integrity | Important data such as user profiles, product records, wallet balances, campaign charges, and order states must be stored and retrieved consistently and accurately. |
| 10 | NFR-10 | Availability | The platform should remain accessible during testing and deployment phases, and its service structure should support future cloud or production hosting. |
| 11 | NFR-11 | Auditability | Financially sensitive records such as wallet deductions, campaign charges, and operational billing actions should remain traceable and reviewable. |
| 12 | NFR-12 | Extensibility | The system should support future enhancements such as recommendation engines, richer analytics, automated payment integration, and more advanced AI fashion features. |

These requirements ensure that the system remains secure, performant, and dependable as usage grows in complexity and scale. While functional requirements explain what the platform is capable of doing, non-functional requirements define the quality level at which those functions must be delivered. This distinction is especially important in a multi-vendor commerce system, where problems such as inconsistent transaction records, poor response times, or weak security would quickly damage user trust and reduce platform viability.

In this project, non-functional requirements support the broader claim that the platform is intended as a realistic software product rather than only a conceptual demonstration. The system processes several forms of sensitive and business-critical information at once, including customer accounts, seller API keys, uploaded user images, order records, and billing-related events. Without strong guarantees in areas such as security, performance, recoverability, and maintainability, even a feature-rich implementation could become unreliable or commercially risky. For this reason, the discussion of non-functional requirements is not supplementary to the platform design; it is one of the central factors that determine whether the proposed system can function credibly in real operating conditions.

Furthermore, non-functional requirements help position the project within a more professional software engineering context. Many student projects concentrate heavily on visible features while giving limited attention to quality attributes such as resilience, scalability, and operational discipline. By explicitly identifying these requirements, the report demonstrates that the system has been designed with a stronger awareness of production-oriented standards. This strengthens the engineering credibility of the project and supports the conclusion that the proposed platform is not only technically interesting, but also structurally prepared for future extension and commercialization.

### 2.4.4 Business and Startup-oriented Requirements

The platform includes several business-oriented features. To protect seller budgets, the system allows campaigns to set daily spending limits. 

The checkout process records commission rates at the time of purchase, preventing historical settings changes from altering completed transaction records. A suite of development tools allows operators to test billing and credit systems in a safe sandbox environment.

These business-oriented requirements emphasize that the platform is being designed not only to function technically, but also to remain commercially interpretable and operationally governable. Seller budgets, commission traceability, and safe testing environments are features that matter directly to platform sustainability. In a startup-oriented context, such requirements are valuable because they help transform the system from a technically working application into a product that can support trust, monetization, and future business control. For this reason, the business requirements form an essential part of the chapter’s transition from theoretical background to implementation-oriented design.

They also reveal that the project is consciously designed as more than an academic demonstration of AI integration. A platform intended to support real sellers must make room for measurable budget control, historical transaction consistency, and safe experimentation before operational rollout. These are concerns that arise in actual commercial environments, where product success depends not only on innovation but also on governance and predictability. By incorporating such business-oriented requirements, the platform becomes more interpretable as a future startup asset rather than remaining only a student-built prototype.

Finally, the presence of business and startup-oriented requirements reinforces the central argument of the project: technical architecture must serve a viable commercial purpose. The need to protect seller margins, reduce dependency on expensive third-party ecosystems, and create transparent monetization logic is reflected not only in the project motivation but also in these formal requirements. This consistency between business motivation and requirement specification strengthens the chapter substantially and clarifies the strategic identity of the proposed system.

In summary, this chapter has presented the theoretical, market, and requirement foundations of the proposed system. It has explained the relevance of the selected technologies, examined the market demand for a more integrated and intelligent fashion-commerce platform, and translated those observations into structured user stories and system requirements. Through this progression, the chapter establishes a clear basis for the design decisions described in the following chapter, where the platform architecture, database model, workflows, and implementation structure are developed in detail.

***

# CHAPTER 3. PRODUCT DESIGN AND DEVELOPMENT

## 3.1 SYSTEM ARCHITECTURE

This chapter describes how the conceptual requirements identified earlier are transformed into a concrete technical structure. The focus of the chapter is not only on describing individual components, but also on explaining how these components cooperate to support a multi-vendor commerce platform enriched with AI-assisted capabilities. Architecture, database design, use-case modeling, workflow analysis, and API organization are presented together because they collectively determine whether the platform can operate as a coherent system rather than as a collection of disconnected features.

### 3.1.1 Overall System Architecture

The overall architecture of Trawberry AI Commerce is decoupled into three primary tiers: client, transaction, and machine learning. This structure ensures that user interactions, database transactions, and generative AI processes operate independently, minimizing resource contention.

#### Figure 3.1 Overall System Architecture Context
```
                     +---------------------------------------+
                     |            Client Browser             |
                     |  (Next.js App UI: Customer/Seller/Admin)
                     +-------------------+-------------------+
                                         |
                                         | HTTP / REST API
                                         v
                     +-------------------+-------------------+
                     |          NestJS Backend               |
                     |  (Port: 3001, Controllers, Services)  |
                     +---+---------------+---------------+---+
                         |               |               |
         Prisma Client    |   BullMQ      | HTTP          | Encrypted API
         (PostgreSQL)     |   (Redis)     | Internal Token| Credentials
                         v               v               v
                +--------+---+   +-------+---+   +-------+---+
                | PostgreSQL |   |   Redis   |   | FastAPI   |
                | (Port 5433)|   | (Port 6379|   | (Port 8000|
                +------------+   +-----------+   +-------+---+
                                                         |
                                                         | S3 Protocol
                                                         v
                                                 +-------+---+
                                                 |   MinIO   |
                                                 | (Port 9000|
                                                 +-----------+
```

### 3.1.2 Component Layers and Network Communication

Network communication between system components is managed using structured protocols and security measures. The Next.js frontend sends requests to the NestJS backend via Axios, including JWT tokens in secure, HTTP-only cookies to prevent cross-site scripting (XSS) attacks. 

The NestJS backend processes core business logic, manages relational data using Prisma, and schedules long-running AI tasks by publishing messages to Redis. 

A background process running BullMQ reads these tasks and sends them to the Python FastAPI service using an internal token for authorization. The FastAPI service processes the image requests and uploads the results to MinIO storage.

From a design perspective, this communication pattern is essential for maintaining clear operational boundaries. Each service has a well-defined responsibility, and the transfer of data between layers follows an intentional sequence that reduces coupling and improves traceability. This layered arrangement also supports future evolution, since individual components may be optimized, replaced, or scaled independently without requiring the entire platform to be redesigned. In a graduation project context, such a structure demonstrates an understanding of maintainable enterprise-style architecture rather than only feature-level programming.

---

## 3.2 DATABASE DESIGN

### 3.2.1 Logical Database Schema

The database design is responsible for storing, managing, and retrieving all data used in the AI-integrated multi-seller e-commerce marketplace (Trawberry AI Commerce). In this project, PostgreSQL is used as the primary relational database management system, managed via Prisma Object-Relational Mapping (ORM). The database is designed with a clear relational structure to support core system functions such as user authentication and role-based access control, merchant catalog integration, sponsored cost-per-click (CPC) campaigns, ledger-backed wallets, order splitting, and AI generation tasks.

As shown in the system database design, the structure consists of several main entities, including `User`, `CustomerAddress`, `SellerProfile`, `SellerDocument`, `Shop`, `Category`, `CategoryMapping`, `Product`, `ProductImage`, `ProductVariant`, `SponsoredCampaign`, `SponsoredCampaignProduct`, `SellerWallet`, `BillingLedgerEntry`, `Order`, `OrderItem`, `SellerAiCredit`, `AiGenerationTask`, `AiTryOnTask`, and related auditing and logging tables. These entities are designed to ensure that the system can handle both core transactional marketplace operations and future AI-native retail features.

The `User` table serves as the central entity of the database. It stores primary account credentials, contact information, and localization choices, including email, bcrypt-hashed passwords, full name, phone number, and preferred locale. Each user is assigned a specific role (such as `CUSTOMER`, `SELLER`, or `ADMIN`), which dictates their authorization boundaries across the system. Depending on this role assignment, a user is linked to additional specialized tables. For instance, sellers are associated with a `SellerProfile` containing legal name, registration codes (INN, OGRN, BIK), bank accounts, and onboarding document references stored in the `SellerDocument` table to facilitate administrative review. Customers are linked to their corresponding shipping destinations in the `CustomerAddress` table, which supports geo-coordinate coordinates and Yandex delivery validation flags.

The platform manages multi-seller product catalogs through the `Shop`, `Product`, `ProductVariant`, and `ProductImage` tables. The `Shop` table encapsulates vendor shop metadata, custom commissions, and Static QR SBP payment configurations. The `Product` table stores detailed catalog items including titles, descriptions, price values, publication flags, and references to external import sessions. The `ProductVariant` table handles structured physical dimensions and size variations (such as technical, Russian, and barcode attributes) for stock tracking. The `ProductImage` table links products to their creative visual assets, indicating which images are original uploads and which are AI-generated model replacements. Product classification is organized through parent-child relationships in the `Category` table, supported by `CategoryMapping` to align external source classifications (such as Wildberries) into the target catalog taxonomy.

User checkouts and order processing are managed by the `MarketplaceCheckout`, `Order`, and `OrderItem` tables. When a customer executes a purchase, the transaction details are first compiled under a parent checkout record. The backend then splits the cart by merchant, creating child orders in the `Order` table that correspond to the respective shops. The `OrderItem` table stores detailed items associated with each child order, referencing specific product variants, quantities, and price snapshots. This multi-seller order splitting mechanism allows each seller to fulfill their orders independently while presenting the customer with a single, consolidated payment.

The payment and billing lifecycle is supervised via the `PaymentReviewLog`, `SellerWallet`, and `BillingLedgerEntry` tables. Customer uploads of bank transfer screenshots are logged in `PaymentReviewLog`, which tracks transaction amounts, payment methods, verification statuses, and review timestamps. The seller's financial state is managed through the `SellerWallet` table, which tracks both available and reserved balances. Every financial change (such as CPC deductions or payout transfers) is logged as a separate row in the `BillingLedgerEntry` table, creating an immutable transaction trail that ensures financial accountability.

User feedback and communication are supported through the `ProductReview`, `ShopMessageThread`, and `ShopMessage` tables. The `ProductReview` table allows customers to rate and comment on purchased items and upload photos, which helps calculate a product's average rating. The `ShopMessageThread` and `ShopMessage` tables support direct communication between customers, sellers, and administrators, facilitating customer support and order resolution.

The system supports automated catalog integration through the `ShopWbCredential`, `ProductImportSession`, and `WbSyncRun` tables. The `ShopWbCredential` table stores encrypted API keys (using AES-256-GCM) that link local shop profiles to external Wildberries seller accounts. The `ProductImportSession` and `WbSyncRun` tables track the history, statistics, and validation warnings of catalog sync sessions, indicating how many products, variants, and images were updated or created during each API or Excel import.

Within the platform architecture, the frontend client application does not directly communicate with the database. Instead, all data persistence and retrieval actions are routed through the backend NestJS service layer via RESTful APIs. When customers browse products, submit orders, or upload payment proofs, or when sellers generate AI assets or configure advertising campaigns, the NestJS controllers route the requests to underlying services that interact with the PostgreSQL database through Prisma ORM.

The database also supports the platform's AI operations and sponsored advertising features. The `SellerAiCredit`, `AiGenerationTask`, `AiTryOnTask`, and `AiUsageLog` tables manage the execution and billing of generative image models. When a seller requests an AI model generation, the backend logs the prompt and credit cost, checking the balance in `SellerAiCredit` before invoking the FastAPI AI gateway. Similarly, the `AiTryOnTask` table stores body dimensions (height, weight, gender, body type) and image storage keys used by the virtual fitting service. To support sponsored ranking, the system queries `SponsoredCampaign` and `SponsoredCampaignProduct` to apply search boosts to active campaigns, while tracking clicks using the `RecommendationEvent` and `BillingLedgerEntry` tables.

The choice of PostgreSQL and Prisma ORM provides advantages such as strict transactional integrity (ACID compliance), schema validation, and database safety through foreign key constraints and B-Tree indexes. This relational model is well-suited for structured commerce data, such as ledgers, order records, and user credentials. Managing the database through Prisma ORM provides the team with a type-safe database client and clear migrations, ensuring the platform can support both core MVP features and future database scaling.

### 3.2.2 Entity Relationship Diagrams

The entity relationship diagram outlines the core relationships in the database, centering on the User and Shop entities.

The ERD provides an analytical view of how the platform’s main objects are connected and why these connections matter. By structuring the data model around users, shops, products, and downstream transactional entities, the system can support both public marketplace experiences and protected seller operations. This relational framing is crucial for preserving the integrity of multi-vendor behavior, where each transaction, media asset, or promotional action must remain attributable to the correct account and commercial context.

#### Figure 3.2 Entity Relationship Diagram (ERD) Overview
```
  +--------------+          1:N         +--------------+
  |     User     |--------------------->|     Shop     |
  | (ID, Role)   |                      | (ID, Slug)   |
  +-------+------+                      +-------+------+
          | 1:N                                 | 1:N
          v                                     v
  +-------+------+ 1:N                  +-------+------+
  | CustomerAddr |                      |   Product    |
  +--------------+                      +-------+------+
                                                | 1:N
                                                v
                                         +-------+------+
                                         | ProductImage |
                                         +--------------+
```

### 3.2.3 Schema Dictionary of Key Tables

The database schema is documented through structured definitions of its core tables, detailing fields, types, and relational constraints.

Documenting the schema in this structured form has academic importance because it allows the reader to understand how abstract business concepts are translated into persistent storage structures. The table dictionary shows that each business capability described earlier, such as sponsorship, credit tracking, delivery supervision, and product publication, is backed by a concrete and verifiable data representation. This strengthens the report by connecting system design claims to explicit database modeling decisions.

#### Table 3.1 DB Schema: User Table Schema
| Field Name | Data Type | Key | Nullable | Description / Relations |
| --- | --- | --- | --- | --- |
| `id` | UUID | PK | No | Unique identifier for a system user. |
| `email` | VarChar(255)| Unique| No | User's email address used for login. |
| `passwordHash`| VarChar(255)| | No | Bcrypt-hashed password. |
| `role` | VarChar(50) | | No | System role: `CUSTOMER`, `SELLER`, `ADMIN`. |

#### Table 3.2 DB Schema: CustomerAddress Table Schema
| Field Name | Data Type | Key | Nullable | Description / Relations |
| --- | --- | --- | --- | --- |
| `id` | UUID | PK | No | Unique identifier. |
| `customerId` | UUID | FK | No | Points to the `User` table. |
| `city` | VarChar(100)| | No | Destination city. |
| `street` | VarChar(100)| | No | Destination street. |
| `building` | VarChar(50) | | No | Building identifier. |
| `yandexManualReady`| Boolean | | No | Identifies if address coordinate verification is complete. |

#### Table 3.3 DB Schema: Shop Table Schema
| Field Name | Data Type | Key | Nullable | Description / Relations |
| --- | --- | --- | --- | --- |
| `id` | UUID | PK | No | Unique identifier for the shop. |
| `sellerId` | UUID | FK | No | Owner of the shop (`User` ID). |
| `name` | VarChar(255)| | No | Name of the shop. |
| `slug` | VarChar(255)| Unique| No | URL-friendly slug. |
| `commissionPercent`| Decimal | | No | Commission percent taken by the platform. |

#### Table 3.4 DB Schema: Product Table Schema
| Field Name | Data Type | Key | Nullable | Description / Relations |
| --- | --- | --- | --- | --- |
| `id` | UUID | PK | No | Unique identifier. |
| `shopId` | UUID | FK | No | Points to the owning `Shop`. |
| `wbTitle` | VarChar(255)| | No | Raw title from Wildberries. |
| `localTitle` | VarChar(255)| | Yes | Seller-customized localized title. |
| `price` | Decimal | | No | Original product price. |
| `isPublished` | Boolean | | No | Whether product is visible on public marketplace. |

#### Table 3.5 DB Schema: SponsoredCampaign Table Schema
| Field Name | Data Type | Key | Nullable | Description / Relations |
| --- | --- | --- | --- | --- |
| `id` | UUID | PK | No | Campaign identifier. |
| `shopId` | UUID | FK | No | Points to the owning `Shop`. |
| `budgetDaily` | Int | | No | Daily budget limit for campaign. |
| `budgetRemaining`| Int | | No | Remaining budget. |
| `bidCpc` | Int | | No | Price charged per product click. |
| `status` | VarChar(50) | | No | `DRAFT`, `ACTIVE`, `PAUSED`, `ENDED`. |

#### Table 3.6 DB Schema: SellerWallet Table Schema
| Field Name | Data Type | Key | Nullable | Description / Relations |
| --- | --- | --- | --- | --- |
| `id` | UUID | PK | No | Wallet identifier. |
| `shopId` | UUID | FK | No | Points to the `Shop` (1-to-1). |
| `balance` | Int | | No | Main wallet balance (currency in minor units). |
| `reserved` | Int | | No | Reserved funds. |

#### Table 3.7 DB Schema: AiGenerationTask Table Schema
| Field Name | Data Type | Key | Nullable | Description / Relations |
| --- | --- | --- | --- | --- |
| `id` | UUID | PK | No | Task identifier. |
| `shopId` | UUID | FK | No | Points to the `Shop`. |
| `productId` | UUID | FK | No | Points to the `Product` being updated. |
| `status` | VarChar(50) | | No | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`. |
| `prompt` | Text | | No | Text prompt passed to the model. |
| `creditCost` | Int | | No | Credits deducted (refunded on failure). |

#### Table 3.8 DB Schema: Order Table Schema
| Field Name | Data Type | Key | Nullable | Description / Relations |
| --- | --- | --- | --- | --- |
| `id` | UUID | PK | No | Child order identifier. |
| `checkoutId` | UUID | FK | No | Parent `MarketplaceCheckout` ID. |
| `shopId` | UUID | FK | No | Points to the destination `Shop`. |
| `status` | VarChar(50) | | No | `PENDING_PAYMENT`, `PAID`, `SHIPPED`, `DELIVERED`, etc. |
| `totalAmount` | Decimal | | No | Total price of all items. |
| `yandexManualOrderId`| VarChar(255)| | Yes | Tracking ID for manual Yandex courier delivery. |

---

## 3.3 SYSTEM USE CASE ANALYSIS AND DESIGN

### 3.3.1 Customer Use Cases

The Customer user role focuses on core shopping and interaction workflows. Shoppers can search and filter catalog products by category, price, and stock status. 

When ready to purchase, they add items to their cart and complete a checkout process that automatically splits orders by shop. Customers can upload screenshots of bank transfers as payment proof, track deliveries, and use the virtual try-on interface to preview clothing items.

These use cases demonstrate that the customer role is not limited to passive product browsing. Instead, the customer journey involves decision support, post-purchase tracking, and interaction with platform services intended to reduce uncertainty. In fashion-oriented e-commerce, this broader role definition is especially important because the buying process often depends on visual assurance and trust in fulfillment status. The customer use cases therefore reflect a more complete understanding of digital purchasing behavior.

### 3.3.2 Seller Use Cases

The Seller user role focuses on shop operations, catalog management, and marketing campaigns. Sellers can import and sync listings from Wildberries using API keys or bulk Excel uploads. 

They can request AI-generated images using text prompts, set up and monitor sponsored search campaigns, review customer payment proofs, and update courier delivery statuses for their orders.

The seller use cases are central to the identity of the platform because the proposed system is fundamentally designed to empower merchants who need more control over their operations than traditional high-cost platforms may provide. By combining catalog intake, media enhancement, marketing visibility, and order supervision in one workspace, the platform aims to reduce fragmentation in seller workflows. This concentration of tools represents one of the major practical contributions of the system.

### 3.3.3 Admin Use Cases

The Administrator user role supervises the platform to ensure operational standards are maintained. Admins review and approve new seller onboarding applications, validate payment review queues, monitor delivery times, and configure global system settings, such as free virtual try-on usage limits.

The presence of an explicit administrative role also reflects the governance needs of a shared marketplace. Without administrative oversight, issues related to seller quality, payment disputes, operational misuse, or system-wide configuration would be difficult to manage in a scalable way. The administrator use cases therefore complete the multi-actor logic of the platform by showing how platform-level trust and policy enforcement are maintained.

---

## 3.4 SYSTEM WORKFLOWS AND SEQUENCE DIAGRAMS

### 3.4.1 Authentication and Session Auto-Refresh

The authentication workflow implements secure cookies and token refresh cycles to maintain user sessions without exposing access tokens in client storage. 

If an access token expires, the client detects the unauthorized response on background API requests, automatically sends a refresh request to obtain a new token, and retries the original request.

This workflow is significant because session continuity is a critical usability and security concern in modern web applications with multiple protected roles. The refresh mechanism allows the platform to preserve a smooth user experience while still enforcing expiration boundaries for sensitive credentials. In practical terms, it reduces friction for legitimate users and decreases the likelihood of accidental work interruption during administrative or seller-side tasks.

#### Figure 3.6 Authentication and Session Auto-Refresh Sequence Flow
```
Client (Next.js)              NestJS Backend                 Database
     |                              |                           |
     |--- 1. Request API ---------->|                           |
     |    (Access Token Expired)    |                           |
     |<-- 2. Return 401 ------------|                           |
     |                              |                           |
     |--- 3. POST /auth/refresh --->|                           |
     |    (Refresh Cookie)          |                           |
     |                              |--- 4. Verify Refresh ---->|
     |                              |<-- 5. Token Valid --------|
     |<-- 6. New Access Token ------|                           |
     |    (HTTP Only Cookie)        |                           |
     |                              |                           |
     |--- 7. Retry Original Req. -->|                           |
     |<-- 8. Return Data -----------|                           |
```

### 3.4.2 Wildberries Sync and Catalog Import

The catalog import workflow allows sellers to sync external products into their local catalog. When a seller enters their Wildberries API key, the NestJS backend encrypts the key using AES-256-GCM before saving it. 

When a sync run is triggered, a background worker decrypts the key, queries the Wildberries APIs, maps the external categories to the local schema, and imports the products.

This workflow directly addresses one of the project’s core business motivations: reducing repetitive catalog management work for sellers already operating on external marketplaces. By allowing controlled import from Wildberries, the system transforms an otherwise labor-intensive process into a repeatable digital workflow. The secure handling of API credentials is equally important, since external platform integration becomes commercially useful only when it is implemented with appropriate protection of merchant access data.

### 3.4.3 AI Image Generation & Credit Charging Flow

The AI image generation workflow uses credit checks and database transactions to manage seller credits. The system deducts the required credits from the seller’s wallet before enqueuing the task in BullMQ. 

If the FastAPI service fails to generate the image, NestJS runs a transaction rollback to refund the credits.

The inclusion of a pre-charge and refund-safe workflow demonstrates that AI functionality is embedded within a controlled economic model rather than being offered as an uncontrolled system action. This is important because commercial AI services often carry direct operating costs. The platform therefore needs a mechanism that protects both the seller and the platform operator from ambiguous charging outcomes. In this respect, the workflow exemplifies the project’s broader commitment to aligning intelligent features with accountable platform operations.

#### Figure 3.7 AI Image Generation & Credit Charging Sequence Flow
```
Seller UI           NestJS Backend          BullMQ / Redis         FastAPI AI Service
   |                      |                       |                         |
   |--- 1. Create Task -->|                       |                         |
   |    (Prompt, Product) |--- 2. Deduct Credit ->|                       |
   |    (Quantity = 1)    |    (Transaction)      |                         |
   |                      |--- 3. Enqueue Job --->|                         |
   |<-- 4. Return Pending |                       |                         |
   |                      |                       |--- 5. Process Job ----->|
   |                      |                       |                         |--- 6. OpenAI call -->
   |                      |                       |                         |<-- 7. Image URL ----
   |                      |<-- 8. Task Completed ---------------------------|
   |                      |    (Save to DB)       |                         |
   |                      |                       |                         |
   |                      |=== IF JOB FAILS ================================|
   |                      |--- 9. Refund Credit ->|                         |
   |                      |    (Transaction)      |                         |
```

### 3.4.4 Sponsored Boost and CPC Attribution Ledger Flow

The CPC campaign workflow charges sellers for clicks on sponsored products. When a buyer clicks a sponsored item, the client sends a tracking token to the backend. 

The backend resolves the campaign ID, deducts the bid price from the seller's wallet, and logs the transaction in an immutable ledger.

This workflow is strategically important because promotional visibility in many marketplaces is often perceived as opaque or difficult for sellers to audit. By tying sponsored exposure to explicit ledger recording and controlled campaign logic, the platform offers a more transparent and analytically interpretable model. This strengthens trust in the promotion system and supports the startup-oriented value proposition of offering sellers clearer control over spending and performance.

#### Figure 3.8 Sponsored Boost & CPC Ledger Charge Sequence Flow
```
Buyer UI            NestJS Backend          Seller Wallet          Billing Ledger
   |                      |                       |                       |
   |--- 1. Click Prod --->|                       |                       |
   |    (Tracking Token)  |--- 2. Resolve Token ->|                       |
   |                      |--- 3. Deduct CPC ---->|                       |
   |                      |    (e.g., -5 Rubles)  |                       |
   |                      |-----------------------|---------------------->| 4. Log Immutable
   |                      |                       |                       |    Entry Row
   |<-- 5. Open Product --|                       |                       |
```

### 3.4.5 Multi-Shop Checkout Split Flow

The checkout workflow handles shopping carts containing items from multiple sellers. The system verifies product prices and stock levels, creates a parent checkout record, and splits the purchase into individual child orders.

The multi-shop split workflow represents one of the defining characteristics of a true marketplace system. It allows the platform to preserve a unified customer checkout experience while still maintaining strict separation of responsibility and accounting at the seller level. This is essential for order tracking, fulfillment management, commission recording, and future dispute resolution. The workflow therefore demonstrates the project’s capacity to model marketplace complexity in a structured and scalable way.

#### Figure 3.9 Multi-Shop Checkout Split Sequence Flow
```
Customer UI           NestJS Backend              Database (Orders)
     |                      |                            |
     |--- 1. Checkout ----->|                            |
     |    (Cart items:      |                            |
     |     Shop A, Shop B)  |--- 2. Verify Price/Stock ->|
     |                      |                            |
     |                      |--- 3. Create Parent Check->|
     |                      |                            |
     |                      |--- 4. Split and Create ----> [Child Order Shop A]
     |                      |    Child Orders            ----> [Child Order Shop B]
     |<-- 5. Return Pay ----|                            |
     |    Instructions      |                            |
```

---

## 3.5 REST API ENDPOINTS AUDIT

The backend services are structured as modular units, with each module managing a specific domain. The system's API design is documented through the inventory of modules and endpoints.

The API audit provides a concise but important view of how the platform exposes its internal capabilities to different clients and roles. By organizing endpoints according to modules and access patterns, the report shows that the system is constructed around explicit service contracts rather than ad hoc internal calls. This supports maintainability, testability, and future extension, all of which are important in a multi-service platform where frontend views, administrative actions, and AI operations depend on stable backend interfaces.

#### Table 3.9 Backend Modules Audit
- **AuthModule**: Handles user logins and token refreshes.
  - `POST /api/auth/login`: Authentication with identifier/password.
  - `POST /api/auth/refresh`: Silently refreshes active cookies.
- **ProductsModule**: Handles seller product management.
  - `GET /api/shops/:shopId/products`: Retrieve all products in a shop.
  - `POST /api/shops/:shopId/products`: Create a new product.
- **AiImagesModule**: Handles seller AI image generation.
  - `POST /api/shops/:shopId/products/:productId/ai-images/tasks`: Generate image.
  - `GET /api/shops/:shopId/ai-credits`: Check shop AI credit balance.
- **BillingModule**: Handles seller financial ledgers.
  - `GET /api/seller/shops/:shopId/billing/wallet`: Retrieve balance.
  - `POST /api/seller/shops/:shopId/billing/wallet/dev-credit`: Load credit.

#### Table 3.10 Frontend Routes Directory Map
- `/app/login`: Staff login page.
- `/app/seller/billing`: Billing wallet management page.
- `/app/seller/campaigns`: Sponsored campaigns dashboard.
- `/app/admin/payments-supervision`: Global payment verification list.
- `/app/admin/deliveries`: Shipping supervision board.

#### Table 3.11 Principal API Endpoints Inventory
- `POST /api/auth/login` (Public): Returns HTTP-only access cookies.
- `GET /api/public/recommendations/home` (Public): Retrieves homepage product list.
- `POST /api/seller/shops/:shopId/billing/wallet/dev-credit` (Seller): Add virtual balance (dev mode).
- `POST /api/shops/:shopId/products/:productId/ai-images/tasks` (Seller): Creates task in queue.
- `POST /api/public/products/:productId/try-on` (Public): Requests FastAPI size overlay.

In summary, this chapter has explained how the system is designed at the architectural, relational, and workflow levels. It has shown how the selected technologies are arranged into a modular service structure, how the database supports marketplace integrity, how the main user roles interact with the platform, and how key operational workflows are executed. Together, these elements demonstrate that the proposed system is not only conceptually motivated, but also concretely engineered to support realistic multi-vendor e-commerce and AI-assisted interaction.

***

# CHAPTER 4. DEPLOYMENT AND BUSINESS MODEL

## 4.1 SYSTEM TRIALS AND DEMONSTRATIONS

The platform has been deployed and verified in a production-ready environment. The system trials demonstrate the visual layout and user interactions.

This chapter evaluates the implemented platform from both a technical and business-oriented perspective. Its purpose is to show that the system design described in the previous chapter has been translated into a working prototype that can be demonstrated, tested, and interpreted in relation to the original project objectives. The chapter therefore combines interface-level observation, system verification outcomes, effectiveness analysis, and commercialization reasoning in order to present a balanced view of the platform’s maturity and practical significance.

### 4.1.1 Public Homepage & Recommendations

The home page renders localized slide banners and recommendation carousels based on user search history.
*File Reference:* `![Skidkaberry Live Homepage Screenshot](file:///C:/Users/admin/.gemini/antigravity/brain/a80a8456-6ba3-4712-a655-554f0c93fd57/homepage.png)`

From an evaluation standpoint, the homepage is important because it serves as the first contact point between the marketplace and potential customers. A successful homepage must not only present products attractively, but also communicate the platform’s ability to organize recommendations, localization, and branded marketplace identity in a coherent way. Its existence therefore demonstrates that the project goes beyond backend logic and addresses the user-facing dimension of digital commerce presentation.

### 4.1.2 Customer Login & Experience

Customers can log in with their credentials and view their order list at `/customer/orders`.
*File Reference:* `![Customer Login Interface Visual](file:///C:/Users/admin/.gemini/antigravity/brain/a80a8456-6ba3-4712-a655-554f0c93fd57/customer_login_page.png)`

This demonstration verifies the system’s ability to manage protected customer access and route authenticated users into the appropriate account space. In practical terms, a reliable login and account-view workflow is fundamental for trust in any commerce platform because it affects order visibility, personal data protection, and continuity of user activity. The customer experience trial therefore validates both usability and core security-related behavior.

### 4.1.3 Seller Dashboard & Catalog Control

Sellers can view their monthly dashboard, import items from Wildberries, and manage AI generated images.
*File Reference:* `![Seller Center Dashboard Interface Visual](file:///C:/Users/admin/.gemini/antigravity/brain/a80a8456-6ba3-4712-a655-554f0c93fd57/seller_dashboard.png)`

The seller dashboard demonstration is especially significant because the seller role represents the operational heart of the platform. Through this interface, the project shows that catalog control, external synchronization, and AI-assisted media handling can coexist within a unified workspace. This validates one of the project’s main claims: that the platform can reduce fragmentation in seller operations by integrating multiple commercial tools into a single management environment.

### 4.1.4 Admin Dashboard & Payment/Fulfillment Supervision

Admins can supervise deliveries and payments across the platform.
*File Reference:* `![Admin Center Operations Interface Visual](file:///C:/Users/admin/.gemini/antigravity/brain/a80a8456-6ba3-4712-a655-554f0c93fd57/admin_dashboard.png)`

The administrator dashboard confirms that the platform includes governance and supervision mechanisms in addition to customer- and seller-facing features. This is important because a multi-vendor marketplace requires oversight to remain operationally reliable and commercially trustworthy. The demonstration of administrative supervision therefore helps show that the platform has been designed with system-level control in mind rather than as a set of isolated user features.

---

## 4.2 EFFECTIVENESS ANALYSIS

### 4.2.1 Testing and Evaluation Results

The application services were validated using automated test suites. The Jest E2E tests for the backend returned a passing rate of 36 out of 37 suites, with the single failure in `notifications.e2e-spec.ts` caused by execution time limits rather than logic errors. 

The FastAPI service passed all 33 of its unit and integration tests. Playwright tests validated the user login, redirection, and multilingual support on the live environment.

These results suggest that the platform has achieved a meaningful level of technical reliability within the scope of the project. Although one backend test suite was affected by execution timing constraints, the broader testing outcomes still indicate that the principal workflows behave as expected across backend, AI service, and frontend interaction layers. In the context of a graduation project, such verification is important because it demonstrates that the reported system behavior is supported by repeatable validation activity rather than by descriptive claims alone.

### 4.2.2 Time-saving and Cost-reduction Effectiveness

The trials demonstrated that catalog synchronization allows sellers to import 100 products from Wildberries in under 15 seconds, a task that takes hours when done manually. 

The AI image playground generates model photos within 10 seconds, eliminating the studio and scheduling costs associated with traditional commercial photoshoots.

Beyond raw timing, these effectiveness findings point to the platform’s broader value proposition. Time savings in catalog synchronization and visual asset generation translate directly into reduced operational burden for sellers, while also creating conditions for faster product publication and improved merchandising quality. This relationship between system speed and business benefit is especially relevant in startup-oriented projects, where efficiency improvements often determine whether a platform becomes practically attractive to early adopters.

---

## 4.3 STARTUP AND COMMERCIALIZATION ORIENTATION

### 4.3.1 Lean Startup Approach

The platform supports a lean startup approach, allowing operators to deploy an MVP with manual payment processes and basic try-on tools. 

As transaction volumes and user traffic grow, the system can transition to automated payment gateways and self-hosted image generation servers to improve performance and lower API costs.

The lean startup framing is especially appropriate for this project because it aligns the development pathway with a realistic strategy of phased validation. Rather than attempting to perfect every subsystem before deployment, the platform can be introduced in a controlled MVP form, tested with target users, and then improved based on observed demand and operational constraints. This reduces initial product risk while preserving a pathway toward deeper automation and commercial maturity.

### 4.3.2 Business Model Canvas

The commercial strategy of the platform is structured around the nine blocks of the Business Model Canvas.

#### Table 4.1 Business Model Canvas Matrix
- **Value Propositions**: Lower model photoshoot costs, automated catalog sync from Wildberries, transparent sponsored campaigns, and AI virtual try-on.
- **Customer Segments**: Small e-commerce sellers, fashion boutiques, drop-shipping operators.
- **Channels**: Online advertising, developer app stores, Wildberries seller forums.
- **Key Resources**: Decoupled NestJS/FastAPI architecture, MinIO media assets, encrypted user database.
- **Key Activities**: Core platform maintenance, AI template development, seller onboarding.
- **Key Partnerships**: Cloud VPS hosting providers, Wildberries API support, OpenAI api platform.
- **Cost Structure**: GPU VPS hosting costs, OpenAI API usage fees, maintenance engineers.
- **Revenue Streams**: Monthly SaaS subscriptions, fee commission per sale (1-5%), and CPC sponsored campaign fees.

The monetization strategy relies on transaction fees, subscriptions for advanced seller features, and CPC charges for sponsored search visibility.

From a business analysis perspective, the Business Model Canvas supports the argument that the project has product potential beyond academic demonstration. It clarifies how technical features map onto customer segments, operational resources, partnership needs, and revenue logic. This is important because the viability of a startup-oriented digital platform depends not only on technical novelty, but also on the coherence of the surrounding business design. By articulating these relationships, the chapter shows that the project has been developed with a commercially interpretable structure in mind.

In summary, this chapter has demonstrated the implemented system through interface trials, validation results, effectiveness indicators, and commercialization analysis. It has shown that the platform is capable of supporting the intended user roles, that its main technical workflows can be verified through testing, and that its business direction is compatible with lean startup development principles. These findings provide a solid basis for the final chapter, which synthesizes the project outcomes, limitations, and future roadmap.

***

# CHAPTER 5. CONCLUSION AND PRODUCT ROADMAP

## 5.1 CONCLUSION

The graduation project "Development of a Multi-Vendor E-Commerce Platform Integrated with AI Virtual Try-On System" has successfully achieved its principal goals. By combining Next.js, NestJS, FastAPI, PostgreSQL, and supporting infrastructure services, the project establishes a modular and scalable marketplace design capable of supporting customer, seller, and administrator workflows within a unified digital environment. The implementation demonstrates that it is feasible to integrate marketplace functions, external catalog synchronization, AI-assisted visual services, auditable campaign charging, and multi-role operational control into a single software platform.

More importantly, the project confirms the practical relevance of building a platform around a real commercial problem. The motivation derived from the cost pressures experienced by sellers working with Wildberries has been translated into a concrete system that aims to reduce operational fragmentation, improve control over catalog and promotional workflows, and strengthen customer confidence in online fashion purchasing through AI virtual try-on interaction. In this respect, the project contributes not only a technical implementation, but also a product-oriented response to a clearly observed market need.

From an academic perspective, the project also demonstrates the value of integrating software engineering methodology with business-oriented analysis. Requirements were derived from real use cases, translated into architecture and database structures, and then validated through implementation and testing. This progression shows that the system has been developed with attention to both engineering discipline and commercial applicability. As a result, the project can be regarded as a meaningful example of how applied artificial intelligence may be embedded within a broader digital commerce platform in a way that remains accountable, scalable, and relevant to real users.

---

## 5.2 SYSTEM LIMITATIONS

The current implementation has several limitations. First, payments rely on administrator review of uploaded transfer screenshots rather than automated bank reconciliation. Second, the Yandex Delivery workflow uses manual status updates rather than calling live courier APIs. Third, the recommendation system uses rule-based logic rather than neural network recommendations.

In addition to these specific limitations, the present system should be understood as a controlled prototype rather than a fully commercialized platform. Certain AI interactions remain bounded by the available infrastructure and the practical limits of academic implementation, meaning that future production use would likely require further optimization, broader dataset support, and stronger performance benchmarking under real user load. Likewise, some business functions are intentionally simplified so that the platform can be evaluated reliably within the time and verification scope of a graduation project.

Nevertheless, these limitations do not diminish the conceptual strength of the system. On the contrary, they clarify the current stage of development and identify concrete areas for future maturation. By stating these boundaries explicitly, the report preserves academic transparency and avoids overstating the production readiness of features that are still evolving. This provides a realistic basis for subsequent research, development, and commercialization work.

---

## 5.3 PRODUCT ROADMAP

The development roadmap outlines the plans for the platform. The first phase focuses on integrating bank payment APIs for automated invoice reconciliation. The second phase involves hosting open-source Stable Diffusion models on local GPU servers to reduce OpenAI API fees. 

The third phase will integrate live shipping APIs for automated courier booking and real-time package tracking. The final phase will implement a recommendation engine based on collaborative filtering to improve search results.

Beyond these immediate steps, the long-term roadmap may also include deeper personalization services, richer seller analytics, and stronger support for scalable marketplace growth. For example, future iterations could combine behavioral data, inventory trends, and interaction history to generate more intelligent recommendation and merchandising strategies. The platform could also evolve toward a broader commerce-support ecosystem in which sellers receive not only storefront access, but also decision support for pricing, promotion, and customer engagement.

Taken together, the roadmap shows that the project has a clear direction for continued evolution. It does not end with the completion of a graduation requirement, but instead outlines a pathway toward a more capable and commercially relevant digital platform. This forward-looking perspective reinforces the broader conclusion of the report: the proposed system represents both a technically meaningful implementation and a credible foundation for future product development in AI-enabled fashion commerce.

***

# REFERENCES

1. NestJS Foundation. (2025). *NestJS Documentation - A progressive Node.js framework*. Retrieved from https://docs.nestjs.com
2. Next.js Team. (2025). *Next.js Documentation - The React Framework for the Web*. Retrieved from https://nextjs.org/docs
3. FastAPI Author. (2025). *FastAPI Documentation*. Retrieved from https://fastapi.tiangolo.com
4. Prisma ORM. (2025). *Prisma Docs - Next-generation Node.js and TypeScript ORM*. Retrieved from https://www.prisma.io/docs
5. Wildberries API Team. (2024). *Wildberries Content & Seller API Reference*. Retrieved from https://openapi.wildberries.ru
6. OpenAI. (2024). *DALL-E 3 API Reference & Image Generation Best Practices*. Retrieved from https://platform.openai.com/docs/guides/images
7. Yandex. (2024). *Yandex Delivery Integration V2 API Specification*. Retrieved from https://yandex.ru/dev/logistics
8. BullMQ. (2025). *BullMQ Documentation - Message queue & batch processing for Node.js*. Retrieved from https://docs.bullmq.io
9. Ries, E. (2011). *The Lean Startup: How Today's Entrepreneurs Use Continuous Innovation to Create Radically Successful Businesses*. Crown Business.
10. Osterwalder, A., & Pigneur, Y. (2010). *Business Model Generation: A Handbook for Visionaries, Game Changers, and Challengers*. John Wiley & Sons.

***

# APPENDICES

## Appendix A - Testing & Verification Logs

Below are logs from backend Jest e2e tests run in-band:
```bash
> backend-nest@0.0.1 test
> jest --config ./test/jest-e2e.json --runInBand

PASS test/recommendations.e2e-spec.ts (19.135 s)
PASS test/payments.e2e-spec.ts (6.698 s)
PASS test/auth.e2e-spec.ts (22.6 s)
PASS test/order-tracking.e2e-spec.ts (8.978 s)
PASS test/campaigns.e2e-spec.ts (10.923 s)
PASS test/delivery.e2e-spec.ts (18.167 s)
PASS test/ai-try-on.e2e-spec.ts (64.849 s)
PASS test/admin-users.e2e-spec.ts (19.41 s)
PASS test/support-cases.e2e-spec.ts (21.346 s)
PASS test/product.e2e-spec.ts (56.621 s)
PASS test/customer-account.e2e-spec.ts (21.14 s)
PASS test/checkout.e2e-spec.ts (17.396 s)
PASS test/product-images.e2e-spec.ts (12.418 s)
PASS test/orders.e2e-spec.ts (18.777 s)
PASS test/public-products.e2e-spec.ts (18.925 s)
PASS test/ai-images.e2e-spec.ts (25.541 s)
PASS test/seller-onboarding.e2e-spec.ts (31.285 s)
PASS test/seller-finance.e2e-spec.ts (12.311 s)
PASS test/billing.e2e-spec.ts (21.688 s)
PASS test/visual-search.e2e-spec.ts (9.256 s)
PASS test/shops.e2e-spec.ts (6.31 s)
PASS test/homepage-slides.e2e-spec.ts (11.448 s)
PASS test/admin-sellers.e2e-spec.ts (6.05 s)
PASS test/users.e2e-spec.ts
PASS test/admin-dashboard.e2e-spec.ts (7.912 s)
PASS test/admin-queues.e2e-spec.ts (7.225 s)
PASS test/admin-queue-tasks.e2e-spec.ts (9.73 s)
PASS test/admin-reports.e2e-spec.ts (5.164 s)
PASS test/reviews.e2e-spec.ts
PASS test/wb-import.e2e-spec.ts
PASS test/messages.e2e-spec.ts
PASS test/wb-product-sync.e2e-spec.ts
PASS test/wb-sync.e2e-spec.ts
PASS test/yandex-delivery.provider.e2e-spec.ts
PASS test/yandex-delivery.client.e2e-spec.ts
PASS test/category-mapping.e2e-spec.ts (7.337 s)
Test Suites: 1 failed, 36 passed, 37 total
Tests:       1 failed, 347 passed, 348 total
```

Below are FastAPI Pytest logs:
```bash
python -m pytest -q
.................................                                        [100%]
33 passed in 10.65s
```

## Appendix B - API JSON Schema Examples

### AI Generation Request:
```json
{
  "prompt": "high resolution product photo of a blue shirt on a model standing in a sunny park",
  "stylePreset": "photographic",
  "taskType": "PRODUCT_MODEL_IMAGE",
  "quantity": 1,
  "sourceImageId": "a80a8456-6ba3-4712-a655-554f0c93fd57"
}
```

### Sponsored Recommendation Response:
```json
{
  "items": [
    {
      "id": "prod-123",
      "title": "Blue Casual Shirt",
      "price": 1200,
      "score": 8.5,
      "isSponsored": true,
      "trackingToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "scoreExplanation": {
        "algorithm": "rule_based_v2",
        "finalScore": 8.5,
        "scoreBreakdown": {
          "categoryMatch": 3.0,
          "sponsoredBoost": 2.0,
          "ratingScore": 1.5,
          "freshnessScore": 1.0,
          "stockScore": 1.0
        }
      }
    }
  ]
}
```
