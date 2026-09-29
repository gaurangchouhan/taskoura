package com.taskoura.service;

import com.taskoura.dto.TemplateDtos.*;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class ProjectTemplateService {

    public record TemplateTask(String title, String category, String priority, String description) {}
    public record TemplateModule(String name, List<TemplateTask> tasks) {}
    public record TemplateDefinition(
            String key,
            String name,
            String description,
            List<TemplateModule> modules
    ) {
        public int getModuleCount() {
            return modules != null ? modules.size() : 0;
        }

        public int getTaskCount() {
            return modules != null ? modules.stream().mapToInt(m -> m.tasks().size()).sum() : 0;
        }
    }

    private final ProjectService projectService;
    private final TaskRepository taskRepository;
    private final Map<String, TemplateDefinition> templates = new LinkedHashMap<>();

    public ProjectTemplateService(ProjectService projectService, TaskRepository taskRepository) {
        this.projectService = projectService;
        this.taskRepository = taskRepository;
        initTemplates();
    }

    private void initTemplates() {
        // 1. Library Management System
        registerTemplate(new TemplateDefinition(
                "library-management",
                "Library Management System",
                "Complete digital cataloging, member checkout, fine tracking, and book inventory management system.",
                List.of(
                        new TemplateModule("User Authentication & Roles", List.of(
                                new TemplateTask("Design users and permissions schema", "Database", "High", "Tables for users, librarians, and roles"),
                                new TemplateTask("Build JWT login and registration API", "Backend", "High", "Secure token authentication endpoints"),
                                new TemplateTask("Develop member and librarian login screens", "Frontend", "Medium", "Responsive authentication views")
                        )),
                        new TemplateModule("Book Catalog & Inventory", List.of(
                                new TemplateTask("Create books and authors table schema", "Database", "High", "Catalog database schema"),
                                new TemplateTask("Implement book search and filter endpoints", "Backend", "High", "Search by ISBN, title, genre, author"),
                                new TemplateTask("Build catalog search and book details view", "Frontend", "Medium", "Browse book inventory with pagination"),
                                new TemplateTask("Add book cover upload and barcode support", "Backend", "Low", "Media storage for book jackets")
                        )),
                        new TemplateModule("Borrowing & Return Operations", List.of(
                                new TemplateTask("Implement loan checkout and return business logic", "Backend", "High", "Tracking due dates and book availability"),
                                new TemplateTask("Calculate overdue fines and late fee rules", "Backend", "Medium", "Automated daily fine computation"),
                                new TemplateTask("Build checkout flow and active loans dashboard", "Frontend", "High", "Patron loans view and renewal actions")
                        )),
                        new TemplateModule("Quality Assurance & Deployment", List.of(
                                new TemplateTask("Write unit tests for loan and fine calculation", "Testing", "High", "Edge case coverage for overdue logic"),
                                new TemplateTask("Draft librarian user manual and API documentation", "Documentation", "Medium", "Operational and API guides"),
                                new TemplateTask("Perform integration testing on borrow-return lifecycle", "Testing", "High", "End-to-end integration tests")
                        ))
                )
        ));

        // 2. Hospital Management System
        registerTemplate(new TemplateDefinition(
                "hospital-management",
                "Hospital Management System",
                "Clinical workflows, doctor scheduling, patient admissions, and electronic medical records.",
                List.of(
                        new TemplateModule("Patient Registration & Triage", List.of(
                                new TemplateTask("Create patients and medical history database schema", "Database", "High", "Relational patient tables"),
                                new TemplateTask("Implement patient intake and registration endpoints", "Backend", "High", "Demographic and insurance intake"),
                                new TemplateTask("Build patient registration and lookup UI", "Frontend", "Medium", "Search patient by MRN or name")
                        )),
                        new TemplateModule("Doctor Consultation & Appointments", List.of(
                                new TemplateTask("Build doctor availability and slot booking API", "Backend", "High", "Appointment scheduling logic"),
                                new TemplateTask("Develop appointment scheduler and calendar view", "Frontend", "High", "Visual booking calendar for reception"),
                                new TemplateTask("Add automated appointment notification reminders", "Backend", "Low", "Email/SMS alerts for upcoming visits")
                        )),
                        new TemplateModule("Electronic Health Records (EHR)", List.of(
                                new TemplateTask("Design prescriptions and diagnosis records table", "Database", "High", "EHR schema design"),
                                new TemplateTask("Build secure medical report access endpoints", "Backend", "High", "Role-gated clinical records access"),
                                new TemplateTask("Create doctor consultation notes UI", "Frontend", "Medium", "Structured doctor encounter notes")
                        )),
                        new TemplateModule("Billing & Compliance", List.of(
                                new TemplateTask("Implement invoice and insurance claim processing", "Backend", "High", "Charge calculation and invoicing"),
                                new TemplateTask("Conduct HIPAA compliance and security audit", "Testing", "High", "Data security penetration and audit testing"),
                                new TemplateTask("Document patient data privacy guidelines", "Documentation", "Medium", "Standard operating procedures")
                        ))
                )
        ));

        // 3. E-Commerce Website
        TemplateDefinition ecommerce = new TemplateDefinition(
                "e-commerce-website",
                "E-Commerce Website",
                "Modern online storefront with product catalog, shopping cart, checkout, payment gateway, and order fulfillment.",
                List.of(
                        new TemplateModule("Product Catalog & Search", List.of(
                                new TemplateTask("Design product, category, and inventory tables", "Database", "High", "Schema for SKUs, variants, prices"),
                                new TemplateTask("Implement product search, filter, and pagination API", "Backend", "High", "Query endpoint with filtering"),
                                new TemplateTask("Build responsive product grid and filter sidebar", "Frontend", "High", "Storefront category catalog view"),
                                new TemplateTask("Create product detail page with image gallery", "Frontend", "Medium", "Product specifications and gallery")
                        )),
                        new TemplateModule("Shopping Cart & Wishlist", List.of(
                                new TemplateTask("Implement session and database-backed cart service", "Backend", "High", "Cart state management"),
                                new TemplateTask("Develop cart drawer and quantity management UI", "Frontend", "High", "Interactive cart sidebar"),
                                new TemplateTask("Add user wishlist save-for-later functionality", "Frontend", "Low", "Saved items collection")
                        )),
                        new TemplateModule("Checkout & Payments", List.of(
                                new TemplateTask("Build order processing and inventory deduction API", "Backend", "High", "Atomic order placement transaction"),
                                new TemplateTask("Integrate Stripe/Razorpay payment gateway", "Backend", "High", "Secure payment webhook handling"),
                                new TemplateTask("Develop multi-step checkout and address form", "Frontend", "High", "Shipping and payment forms")
                        )),
                        new TemplateModule("Order Tracking & Support", List.of(
                                new TemplateTask("Build customer order history and tracking API", "Backend", "Medium", "Order timeline status updates"),
                                new TemplateTask("Create customer order tracking portal", "Frontend", "Medium", "User dashboard with order status"),
                                new TemplateTask("Write end-to-end checkout automation tests", "Testing", "High", "Comprehensive cart to order tests"),
                                new TemplateTask("Document API endpoints and payment webhooks", "Documentation", "Low", "Developer API specs")
                        ))
                )
        );
        registerTemplate(ecommerce);
        // Register common aliases for e-commerce
        templates.put("ecommerce-website", ecommerce);
        templates.put("e-commerce", ecommerce);

        // 4. Student Management System
        registerTemplate(new TemplateDefinition(
                "student-management",
                "Student Management System",
                "Academic record keeping, course enrollment, attendance tracking, and grade report generation.",
                List.of(
                        new TemplateModule("Student Profiles & Admissions", List.of(
                                new TemplateTask("Design student, department, and semester schema", "Database", "High", "Academic database model"),
                                new TemplateTask("Implement student enrollment and profile CRUD API", "Backend", "High", "Student record maintenance"),
                                new TemplateTask("Build student directory and profile editor UI", "Frontend", "Medium", "Admin student management table")
                        )),
                        new TemplateModule("Course Management & Registration", List.of(
                                new TemplateTask("Create courses and prerequisites database tables", "Database", "High", "Course catalog and prerequisites"),
                                new TemplateTask("Build course registration and capacity limit logic", "Backend", "High", "Seat limit and enrollment validation"),
                                new TemplateTask("Develop student course selection interface", "Frontend", "High", "Student course registration portal")
                        )),
                        new TemplateModule("Attendance & Grading", List.of(
                                new TemplateTask("Implement daily attendance recording API", "Backend", "Medium", "Classroom attendance tracking"),
                                new TemplateTask("Build grade submission and GPA calculation engine", "Backend", "High", "Automated semester GPA computation"),
                                new TemplateTask("Create teacher grading portal and student report card", "Frontend", "High", "Instructor grading interface")
                        )),
                        new TemplateModule("Reports & Documentation", List.of(
                                new TemplateTask("Generate semester transcript PDF export", "Backend", "Medium", "Official transcript report builder"),
                                new TemplateTask("Write test suite for GPA calculation rules", "Testing", "High", "Unit tests for grading scale edge cases"),
                                new TemplateTask("Draft teacher onboarding and administration guide", "Documentation", "Low", "User handbook")
                        ))
                )
        ));

        // 5. Portfolio Website
        registerTemplate(new TemplateDefinition(
                "portfolio-website",
                "Portfolio Website",
                "Showcase personal projects, technical skill stack, blog articles, and interactive contact form.",
                List.of(
                        new TemplateModule("Hero & About Sections", List.of(
                                new TemplateTask("Design responsive layout and theme system", "Frontend", "High", "Modern dark/light UI layout"),
                                new TemplateTask("Build dynamic bio, avatar, and social links", "Frontend", "Medium", "Profile hero introduction"),
                                new TemplateTask("Create interactive skill badge cloud", "Frontend", "Low", "Visual tech stack badges")
                        )),
                        new TemplateModule("Project Showcase", List.of(
                                new TemplateTask("Create projects schema and markdown metadata storage", "Database", "Medium", "Project showcase repository"),
                                new TemplateTask("Build project showcase grid with category filters", "Frontend", "High", "Filterable project cards"),
                                new TemplateTask("Develop project detail modal with live demo links", "Frontend", "Medium", "Deep-dive case study modal")
                        )),
                        new TemplateModule("Contact & Lead Generation", List.of(
                                new TemplateTask("Build contact form submission API with email alerts", "Backend", "High", "Form submission handler"),
                                new TemplateTask("Create interactive contact form with validation", "Frontend", "High", "Client-side verified form"),
                                new TemplateTask("Add reCAPTCHA spam protection", "Backend", "Medium", "Bot submission filter")
                        )),
                        new TemplateModule("Testing & SEO Optimization", List.of(
                                new TemplateTask("Audit Lighthouse performance, SEO, and accessibility", "Testing", "High", "Lighthouse 100 score audit"),
                                new TemplateTask("Add OpenGraph meta tags and sitemap.xml generation", "Frontend", "Medium", "Search and social media previews"),
                                new TemplateTask("Write deployment and maintenance documentation", "Documentation", "Low", "Hosting setup notes")
                        ))
                )
        ));
    }

    private void registerTemplate(TemplateDefinition template) {
        templates.put(template.key().toLowerCase(Locale.ROOT), template);
    }

    public TemplateListResponse getTemplates() {
        // Return unique primary templates
        Set<String> seen = new HashSet<>();
        List<TemplateSummary> summaries = new ArrayList<>();

        for (TemplateDefinition t : templates.values()) {
            if (seen.add(t.key())) {
                summaries.add(new TemplateSummary(
                        t.key(),
                        t.name(),
                        t.description(),
                        t.getModuleCount(),
                        t.getTaskCount()
                ));
            }
        }

        return new TemplateListResponse(summaries);
    }

    @Transactional
    public ApplyTemplateResponse applyTemplate(UUID projectId, String templateKey) {
        Project project = projectService.getProjectEntityOrThrow(projectId);

        if (templateKey == null || templateKey.isBlank()) {
            throw new NotFoundException("Template key is required");
        }

        TemplateDefinition template = templates.get(templateKey.toLowerCase(Locale.ROOT).trim());
        if (template == null) {
            throw new NotFoundException("Template not found: " + templateKey);
        }

        List<UUID> createdTaskIds = new ArrayList<>();
        for (TemplateModule module : template.modules()) {
            for (TemplateTask item : module.tasks()) {
                Task task = Task.builder()
                        .project(project)
                        .title(item.title())
                        .description(item.description())
                        .category(item.category())
                        .priority(item.priority())
                        .status("Backlog")
                        .build();
                Task saved = taskRepository.save(task);
                createdTaskIds.add(saved.getId());
            }
        }

        return new ApplyTemplateResponse(createdTaskIds.size(), createdTaskIds);
    }
}
