BEGIN;

CREATE TABLE IF NOT EXISTS model_calibration (
    id                      BIGSERIAL PRIMARY KEY,
    model_version           TEXT NOT NULL,
    sample_size             INT NOT NULL,
    median_error_pct        NUMERIC(6,2) NOT NULL,
    within_band_pct         NUMERIC(6,2) NOT NULL,
    uncertainty_mult        NUMERIC(4,2) NOT NULL,
    segment_breakdown       JSONB,
    length_breakdown        JSONB,
    basis_breakdown         JSONB,
    ai_present_breakdown    JSONB,
    evaluated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_calibration_ver_eval ON model_calibration(model_version, evaluated_at DESC);

COMMIT;
