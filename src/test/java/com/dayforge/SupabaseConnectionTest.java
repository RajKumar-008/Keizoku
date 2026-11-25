package com.dayforge;

import com.dayforge.config.DatabaseConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.*;

public class SupabaseConnectionTest {

    @Test
    @DisplayName("Supabase URL Normalization: Converts standard URI and enforces SSL")
    void testUrlNormalization() {
        // Standard URI format copied from Supabase dashboard
        String rawSupabaseUri = "postgresql://postgres.myproject:secret@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
        String normalized = DatabaseConfig.normalizeJdbcUrl(rawSupabaseUri);

        assertTrue(normalized.startsWith("jdbc:postgresql://"), "Must begin with jdbc:postgresql://");
        assertTrue(normalized.contains("sslmode=require"), "Must enforce sslmode=require for cloud security");
        assertFalse(normalized.contains("secret@"), "Embedded credentials must be removed from the JDBC URL");
    }

    @Test
    @DisplayName("Supabase URL Normalization: Preserves existing sslmode if already present")
    void testUrlNormalizationWithExistingSsl() {
        String rawJdbc = "jdbc:postgresql://db.abcdef.supabase.co:5432/postgres?sslmode=require";
        String normalized = DatabaseConfig.normalizeJdbcUrl(rawJdbc);

        assertEquals("jdbc:postgresql://db.abcdef.supabase.co:5432/postgres?sslmode=require", normalized);
    }

    @Test
    @DisplayName("Security: Credential Masking in Database Logging")
    void testCredentialSanitization() {
        String sensitiveUrl = "jdbc:postgresql://postgres.abcdef:MySuperSecret123@aws-0.pooler.supabase.com:5432/postgres";
        String sanitized = DatabaseConfig.sanitizeUrlForLogging(sensitiveUrl);

        assertFalse(sanitized.contains("MySuperSecret123"), "Password must never be logged");
        assertTrue(sanitized.contains("***:***"), "Credentials must be masked with placeholder");
    }

    @Test
    @DisplayName("PostgreSQL Driver: org.postgresql.Driver is available on classpath")
    void testPostgresDriverAvailable() {
        assertDoesNotThrow(() -> Class.forName("org.postgresql.Driver"),
                "PostgreSQL JDBC driver must be present on the classpath");
    }

    @Test
    @DisplayName("Supabase URL Normalization: Handles embedded password containing '@' and extracts credentials")
    void testUrlNormalizationWithAtInPassword() {
        String rawSupabaseUri = "postgresql://postgres.njdpstizttwhrbuikjup:p@ss@word@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
        String normalized = DatabaseConfig.normalizeJdbcUrl(rawSupabaseUri);
        DatabaseConfig.ParsedCredentials creds = DatabaseConfig.extractCredentialsIfEmbedded(rawSupabaseUri, "", "");

        assertEquals("jdbc:postgresql://aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require", normalized);
        assertEquals("postgres.njdpstizttwhrbuikjup", creds.username);
        assertEquals("p@ss@word", creds.password);
    }

    @Test
    @DisplayName("PostgreSQL Validation: Fails fast on missing or invalid pooler credentials")
    void testPostgresValidationFailsFast() {
        String poolerUrl = "jdbc:postgresql://aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require";

        assertThrows(IllegalStateException.class, () ->
                DatabaseConfig.validatePostgresConfiguration(poolerUrl, new DatabaseConfig.ParsedCredentials("", "secret")));

        assertThrows(IllegalStateException.class, () ->
                DatabaseConfig.validatePostgresConfiguration(poolerUrl, new DatabaseConfig.ParsedCredentials("postgres.njdpstizttwhrbuikjup", "")));

        assertThrows(IllegalStateException.class, () ->
                DatabaseConfig.validatePostgresConfiguration(poolerUrl, new DatabaseConfig.ParsedCredentials("postgres", "secret")));

        assertDoesNotThrow(() ->
                DatabaseConfig.validatePostgresConfiguration(poolerUrl, new DatabaseConfig.ParsedCredentials("postgres.njdpstizttwhrbuikjup", "secret")));
    }

    @Test
    @DisplayName("URL Query & Credential Precedence: Strips URL user/password params and preserves full SUPABASE_DB_USERNAME")
    void testUrlQuerySanitizationAndCredentialPrecedence() {
        String urlWithQueryUser = "jdbc:postgresql://aws-0-ap-south-1.pooler.supabase.com:5432/postgres?user=postgres&password=wrong&sslmode=require";
        String normalized = DatabaseConfig.normalizeJdbcUrl(urlWithQueryUser);

        assertEquals("jdbc:postgresql://aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require", normalized);
        assertFalse(normalized.contains("user="), "URL must not override SUPABASE_DB_USERNAME");
        assertFalse(normalized.contains("password="), "URL must not embed password parameter");

        String urlWithEmbeddedUser = "postgresql://postgres:wrong@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
        DatabaseConfig.ParsedCredentials creds = DatabaseConfig.resolveCredentials(
                urlWithEmbeddedUser, "postgres.njdpstizttwhrbuikjup", "real#pass@123");

        assertEquals("postgres.njdpstizttwhrbuikjup", creds.username, "Full Session Pooler username must be preserved");
        assertEquals("real#pass@123", creds.password, "Configured SUPABASE_DB_PASSWORD must take precedence");
    }

    @Test
    @DisplayName("Live Supabase Connectivity Probe: Executed when environment variables are supplied")
    void testLiveSupabaseConnectivityIfConfigured() {
        String dbUrl = System.getenv("SUPABASE_DB_URL");
        String dbUser = System.getenv("SUPABASE_DB_USERNAME");
        String dbPass = System.getenv("SUPABASE_DB_PASSWORD");

        if (dbUrl == null || dbUrl.isBlank()) {
            System.out.println("[INFO] SUPABASE_DB_URL is not set in environment. Skipping live network probe.");
            return;
        }

        String jdbcUrl = DatabaseConfig.normalizeJdbcUrl(dbUrl);
        assertDoesNotThrow(() -> {
            try (Connection conn = DriverManager.getConnection(jdbcUrl, dbUser, dbPass);
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT 1")) {
                assertTrue(rs.next(), "Supabase query should return at least 1 record");
                assertEquals(1, rs.getInt(1), "Supabase query should return 1");
                System.out.println("[INFO] Successfully connected to live Supabase PostgreSQL database: " + conn.getMetaData().getDatabaseProductVersion());
            }
        }, "Supabase database connection failed with provided credentials");
    }
}
