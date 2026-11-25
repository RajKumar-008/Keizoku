package com.dayforge.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;
import java.io.File;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

@Configuration
public class DatabaseConfig {

    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);

    @Value("${spring.datasource.url}")
    private String rawUrl;

    @Value("${spring.datasource.username:}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    @Value("${spring.datasource.driver-class-name:}")
    private String driverClassName;

    @Value("${spring.datasource.hikari.maximum-pool-size:10}")
    private int maxPoolSize;

    @Value("${spring.datasource.hikari.minimum-idle:2}")
    private int minIdle;

    private final Environment env;

    public DatabaseConfig(Environment env) {
        this.env = env;
    }

    /**
     * Primary DataSource bean with support for H2 persistent storage,
     * directory validation, automated legacy migration, and Supabase PostgreSQL.
     */
    @Bean
    @Primary
    public DataSource dataSource() {
        String activeProfile = String.join(",", env.getActiveProfiles());
        log.info("Initializing DataSource for active profiles: [{}]", activeProfile.isEmpty() ? "default" : activeProfile);

        // Normalize URL (converts postgresql:// to jdbc:postgresql://, strips embedded/query credentials, ensures sslmode=require)
        String jdbcUrl = normalizeJdbcUrl(rawUrl);

        if (jdbcUrl == null || jdbcUrl.isBlank()) {
            throw new IllegalStateException("Database JDBC URL is missing. Set SUPABASE_DB_URL.");
        }

        // Prepare H2 directory and handle data safety ONLY when explicitly using H2 storage
        if (jdbcUrl.startsWith("jdbc:h2:file:") || jdbcUrl.startsWith("jdbc:h2:")) {
            prepareH2Storage(jdbcUrl);
        }

        // Configured credentials (SUPABASE_DB_USERNAME / SUPABASE_DB_PASSWORD) take strict precedence
        ParsedCredentials creds = resolveCredentials(rawUrl, username, password);

        if (jdbcUrl.startsWith("jdbc:postgresql:")) {
            validatePostgresConfiguration(jdbcUrl, creds);
            logSafePostgresDiagnostics(jdbcUrl, creds);
        } else {
            log.info("Database target configured: mode=H2, target={}", sanitizeUrlForLogging(jdbcUrl));
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(creds.username);
        config.setPassword(creds.password);

        // Determine driver class if not explicitly configured
        String effectiveDriver = driverClassName;
        if (effectiveDriver == null || effectiveDriver.isBlank()) {
            if (jdbcUrl.startsWith("jdbc:h2:")) {
                effectiveDriver = "org.h2.Driver";
            } else {
                effectiveDriver = "org.postgresql.Driver";
            }
        }
        config.setDriverClassName(effectiveDriver);

        // HikariCP pool tuning
        config.setMaximumPoolSize(maxPoolSize);
        config.setMinimumIdle(minIdle);
        config.setIdleTimeout(300000);         // 5 minutes
        config.setMaxLifetime(900000);         // 15 minutes
        config.setConnectionTimeout(20000);     // 20 seconds
        config.setKeepaliveTime(300000);       // 5 minutes keepalive
        config.setPoolName("KeizokuHikariPool");

        // SSL & TCP parameters for PostgreSQL / Supabase
        if (jdbcUrl.startsWith("jdbc:postgresql:")) {
            config.addDataSourceProperty("ssl", "true");
            config.addDataSourceProperty("sslmode", "require");
            config.addDataSourceProperty("tcpKeepAlive", "true");
            config.addDataSourceProperty("reWriteBatchedInserts", "true");
        }

        log.info("HikariCP DataSource configured successfully for target: {}", sanitizeUrlForLogging(jdbcUrl));
        return new HikariDataSource(config);
    }

    /**
     * Prepares and validates directory storage for H2 file-based databases.
     * Also safely migrates any legacy database file (e.g. dayforgedb.mv.db -> keizoku.mv.db) if present.
     */
    private void prepareH2Storage(String jdbcUrl) {
        try {
            String pathPart = jdbcUrl;
            if (pathPart.startsWith("jdbc:h2:file:")) {
                pathPart = pathPart.substring("jdbc:h2:file:".length());
            } else if (pathPart.startsWith("jdbc:h2:")) {
                pathPart = pathPart.substring("jdbc:h2:".length());
            }

            int semicolonIdx = pathPart.indexOf(';');
            if (semicolonIdx > 0) {
                pathPart = pathPart.substring(0, semicolonIdx);
            }

            File targetDbFile = new File(pathPart);
            File parentDir = targetDbFile.getParentFile();

            if (parentDir != null) {
                if (!parentDir.exists()) {
                    boolean created = parentDir.mkdirs();
                    log.info("H2 database storage directory created [{}]: {}", parentDir.getAbsolutePath(), created);
                }

                log.info("H2 database storage directory: {} (exists={}, writable={}, readable={})",
                        parentDir.getAbsolutePath(), parentDir.exists(), parentDir.canWrite(), parentDir.canRead());

                // Check for legacy database migration (e.g., dayforgedb.mv.db -> keizoku.mv.db)
                File targetMvDb = new File(parentDir, targetDbFile.getName() + ".mv.db");
                if (!targetMvDb.exists()) {
                    File legacySameDir = new File(parentDir, "dayforgedb.mv.db");
                    if (legacySameDir.exists()) {
                        log.info("Found legacy database file at {}. Performing safe migration to {}...",
                                legacySameDir.getAbsolutePath(), targetMvDb.getAbsolutePath());
                        Files.copy(legacySameDir.toPath(), targetMvDb.toPath(), StandardCopyOption.COPY_ATTRIBUTES);
                        log.info("Migration successful. Existing data preserved in {}", targetMvDb.getAbsolutePath());
                    }
                } else {
                    log.info("Existing H2 database file detected at {} (size: {} bytes). Preserving user data.",
                            targetMvDb.getAbsolutePath(), targetMvDb.length());
                }
            }
        } catch (Exception e) {
            log.error("Error inspecting or preparing H2 database directory: {}", e.getMessage(), e);
        }
    }

    /**
     * Converts standard URI formats (postgresql:// or postgres://) to JDBC (jdbc:postgresql://)
     * and guarantees sslmode=require for PostgreSQL targets.
     */
    public static String normalizeJdbcUrl(String url) {
        if (url == null || url.isBlank()) {
            return url;
        }

        String normalized = url.trim();

        // Handle raw postgres:// or postgresql:// schemes
        if (normalized.startsWith("postgres://")) {
            normalized = "jdbc:postgresql://" + normalized.substring("postgres://".length());
        } else if (normalized.startsWith("postgresql://")) {
            normalized = "jdbc:postgresql://" + normalized.substring("postgresql://".length());
        }

        // If credentials are in URL (jdbc:postgresql://user:pass@host), remove credentials from JDBC url
        if (normalized.startsWith("jdbc:postgresql://")) {
            int authorityStart = "jdbc:postgresql://".length();
            int pathOrQueryStart = findAuthorityEnd(normalized, authorityStart);
            int atIndex = normalized.lastIndexOf('@', pathOrQueryStart - 1);
            if (atIndex >= authorityStart) {
                normalized = "jdbc:postgresql://" + normalized.substring(atIndex + 1);
            }
        }

        // Strip any user/password query parameters so URL parameters never override SUPABASE_DB_USERNAME / SUPABASE_DB_PASSWORD
        if (normalized.startsWith("jdbc:postgresql:")) {
            normalized = sanitizePostgresQueryParams(normalized);
        }

        // Enforce sslmode=require for PostgreSQL endpoints if not already specified
        if (normalized.startsWith("jdbc:postgresql:") && !normalized.contains("sslmode=")) {
            normalized += (normalized.contains("?") ? "&" : "?") + "sslmode=require";
        }

        return normalized;
    }

    private static String sanitizePostgresQueryParams(String url) {
        int queryIdx = url.indexOf('?');
        if (queryIdx < 0) {
            return url;
        }
        String base = url.substring(0, queryIdx);
        String query = url.substring(queryIdx + 1);
        if (query.isBlank()) {
            return base;
        }
        StringBuilder filtered = new StringBuilder();
        for (String param : query.split("&")) {
            if (param.isEmpty()) {
                continue;
            }
            int eqIdx = param.indexOf('=');
            String key = (eqIdx >= 0 ? param.substring(0, eqIdx) : param).trim().toLowerCase();
            if ("user".equals(key) || "username".equals(key) || "password".equals(key)) {
                continue;
            }
            if (filtered.length() > 0) {
                filtered.append('&');
            }
            filtered.append(param);
        }
        return filtered.length() > 0 ? base + "?" + filtered : base;
    }

    private static int findAuthorityEnd(String url, int start) {
        int slashIdx = url.indexOf('/', start);
        int queryIdx = url.indexOf('?', start);
        if (slashIdx < 0) return (queryIdx < 0) ? url.length() : queryIdx;
        if (queryIdx < 0) return slashIdx;
        return Math.min(slashIdx, queryIdx);
    }

    /**
     * Fails fast when PostgreSQL is configured without valid credentials so the app
     * never sends an empty or truncated username to Supabase and never silently falls back to 'postgres' or H2.
     */
    public static void validatePostgresConfiguration(String jdbcUrl, ParsedCredentials creds) {
        if (creds.username == null || creds.username.isBlank()) {
            throw new IllegalStateException(
                    "PostgreSQL username is missing. Set SUPABASE_DB_USERNAME (e.g. postgres.<project_ref> for Supabase Session Pooler).");
        }
        if (creds.password == null || creds.password.isBlank()) {
            throw new IllegalStateException(
                    "PostgreSQL password is missing. Set SUPABASE_DB_PASSWORD.");
        }
        if (jdbcUrl.contains("pooler.supabase.com") && !creds.username.contains(".")) {
            throw new IllegalStateException(
                    "Invalid Supabase Session Pooler username format: expected '<user>.<project_ref>' (e.g. 'postgres.njdpstizttwhrbuikjup').");
        }
    }

    private static void logSafePostgresDiagnostics(String jdbcUrl, ParsedCredentials creds) {
        String host = "unknown";
        String port = "5432";
        String dbName = "unknown";
        String sslMode = jdbcUrl.contains("sslmode=") ? jdbcUrl.replaceAll(".*sslmode=([^&]+).*", "$1") : "require";

        try {
            String clean = jdbcUrl.startsWith("jdbc:") ? jdbcUrl.substring(5) : jdbcUrl;
            URI uri = URI.create(clean);
            if (uri.getHost() != null) {
                host = uri.getHost();
            }
            if (uri.getPort() > 0) {
                port = String.valueOf(uri.getPort());
            }
            if (uri.getPath() != null && uri.getPath().length() > 1) {
                dbName = uri.getPath().substring(1);
            }
        } catch (Exception ignored) {
            // Keep safe defaults
        }

        String connectionMode;
        if (host.contains("pooler.supabase.com")) {
            connectionMode = "6543".equals(port) ? "Supabase Transaction Pooler" : "Supabase Session Pooler";
        } else {
            connectionMode = "PostgreSQL Direct";
        }

        boolean usernameConfigured = creds.username != null && !creds.username.isBlank();
        boolean passwordConfigured = creds.password != null && !creds.password.isEmpty();
        boolean hasProjectRefSuffix = usernameConfigured && creds.username.contains(".");

        log.info("PostgreSQL Diagnostics -> host={}, port={}, database={}, mode={}, sslmode={}, usernameConfigured={}, usernameHasProjectRef={}, passwordConfigured={}",
                host, port, dbName, connectionMode, sslMode, usernameConfigured, hasProjectRefSuffix, passwordConfigured);
    }

    /**
     * Resolves credentials giving strict priority to configured properties (SUPABASE_DB_USERNAME / SUPABASE_DB_PASSWORD).
     * Only inspects embedded URL credentials if configured properties are blank.
     */
    public static ParsedCredentials resolveCredentials(String url, String configuredUser, String configuredPass) {
        boolean hasConfiguredUser = configuredUser != null && !configuredUser.isBlank();
        boolean hasConfiguredPass = configuredPass != null && !configuredPass.isEmpty();
        if (hasConfiguredUser || hasConfiguredPass) {
            return new ParsedCredentials(
                    hasConfiguredUser ? configuredUser : "",
                    hasConfiguredPass ? configuredPass : "");
        }
        return extractCredentialsIfEmbedded(url, "", "");
    }

    /**
     * Extracts embedded username and password if user provided standard URI with credentials
     */
    public static ParsedCredentials extractCredentialsIfEmbedded(String url, String fallbackUser, String fallbackPass) {
        if (url != null && (url.startsWith("postgres://") || url.startsWith("postgresql://") || url.startsWith("jdbc:postgresql://"))) {
            String cleanUrl = url.trim();
            if (cleanUrl.startsWith("jdbc:")) {
                cleanUrl = cleanUrl.substring(5);
            }
            int schemeEnd = cleanUrl.indexOf("://");
            if (schemeEnd >= 0) {
                int authorityStart = schemeEnd + 3;
                int authorityEnd = findAuthorityEnd(cleanUrl, authorityStart);
                int atIndex = cleanUrl.lastIndexOf('@', authorityEnd - 1);
                if (atIndex > authorityStart) {
                    String userInfo = cleanUrl.substring(authorityStart, atIndex);
                    int colonIdx = userInfo.indexOf(':');
                    if (colonIdx >= 0) {
                        String rawUser = userInfo.substring(0, colonIdx);
                        String rawPass = userInfo.substring(colonIdx + 1);
                        String user = !rawUser.isBlank() ? rawUser : fallbackUser;
                        String pass = !rawPass.isEmpty() ? rawPass : fallbackPass;
                        return new ParsedCredentials(user, pass);
                    }
                }
            }
            try {
                URI uri = URI.create(cleanUrl);
                String userInfo = uri.getUserInfo();
                if (userInfo != null && userInfo.contains(":")) {
                    String[] parts = userInfo.split(":", 2);
                    String user = (parts[0] != null && !parts[0].isBlank()) ? parts[0] : fallbackUser;
                    String pass = (parts.length > 1 && parts[1] != null) ? parts[1] : fallbackPass;
                    return new ParsedCredentials(user, pass);
                }
            } catch (Exception ignored) {
                // Fall back to configured properties
            }
        }
        return new ParsedCredentials(fallbackUser, fallbackPass);
    }

    /**
     * Safe URL logger that strips any sensitive information.
     */
    public static String sanitizeUrlForLogging(String url) {
        if (url == null) return "null";
        // Strip authority credentials and query credentials if present
        return url.replaceAll("://.*?:.*?@", "://***:***@")
                  .replaceAll("(?i)([?&](?:user|username|password)=)[^&]*", "$1***");
    }

    public static class ParsedCredentials {
        public final String username;
        public final String password;

        public ParsedCredentials(String username, String password) {
            this.username = username;
            this.password = password;
        }
    }
}
