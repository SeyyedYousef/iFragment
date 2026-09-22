package laya

// QuestionType represents the primitive question types supported by Laya System 1 (Convai Innovations).
type QuestionType string

const (
	TypeChoice QuestionType = "choice"
	TypeScore  QuestionType = "score"
	TypeNoul   QuestionType = "noul"
)

// Question represents a typed question submitted to Laya.
type Question struct {
	Type         QuestionType      `json:"type"`
	Instructions string            `json:"instructions"`
	Criteria     map[string]string `json:"criteria,omitempty"`
}

// Request is the payload sent to Laya System 1 decision engine.
type Request struct {
	Model     string              `json:"model"`
	State     any                 `json:"state"`
	Questions map[string]Question `json:"questions"`
}

// Answer is the calibrated typed output from Laya.
type Answer struct {
	Type          QuestionType       `json:"type"`
	Choice        string             `json:"choice,omitempty"`
	Score         int                `json:"score,omitempty"`
	Noul          float64            `json:"noul,omitempty"`
	Probabilities map[string]float64 `json:"probabilities,omitempty"`
	Confidence    float64            `json:"confidence,omitempty"`
}

// Usage contains token/inference accounting.
type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// Response is the top-level response from Laya System 1.
type Response struct {
	Model   string            `json:"model"`
	Answers map[string]Answer `json:"answers"`
	Usage   Usage             `json:"usage"`
	Error   string            `json:"error,omitempty"`
}
